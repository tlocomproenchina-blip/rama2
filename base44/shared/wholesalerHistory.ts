// Historial de pre-alertas de cada app mayorista: se le pide su historial
// completo (paginado), se reconoce cada carga por su tracking exacto y se alinea
// con lo que ya existe en TLEC CARGO. Nunca duplica: lo que ya estaba se omite, lo
// que existe a medias se completa sin pisar nada y lo que no estaba se registra
// igual, aunque el cliente todavía no se reconozca (queda como huérfano para
// asignarlo después). Después de alinear, le devuelve al mayorista las coincidencias
// que ya constan recibidas en el almacén —con su tracking, su cliente y su foto—
// para que su app marque esas cargas como recibidas. Los datos del almacén no se
// modifican desde aquí: solo se leen para confirmar la recepción.
import {
  connectionKeyOf,
  connectionLabel,
  logWholesalerEvent,
  outboundKeyFor,
  stampOf,
  truncate,
  updateConnection,
} from './wholesalerCore.ts';
import { cleanTracking, findClientForNotice, queueReceptionNotice, receptionPhotos, trackingOwnerFor } from './wholesalerPackages.ts';
import { notifyReceptionBlock } from './wholesalerNotify.ts';
import {
  buildTrackingCandidates,
  consolidateOrphan,
  findSameShipmentMatches,
  hasReceptionEvidence,
  unifyOrphanIntoClientRecord,
} from './orphanConsolidation.ts';

const TIMEOUT_MS = 20000;
const PAGE_SIZE = 200;
const MAX_PAGES = 50;
const MAX_RECORDS = 5000;
const MAX_ERROR_SAMPLES = 5;

// Devolución al mayorista de las coincidencias ya recibidas: cuántas se le confirman
// en una misma corrida (las que siguen se devuelven en la corrida siguiente, sin
// repetir las que ya salieron) y de cuántas en cuántas viajan en cada envío.
const MAX_NOTIFY_PER_RUN = 60;
const NOTIFY_BLOCK = 20;
// Fichas de cada registro de la corrida que se guardan para el detalle del panel.
const MAX_DETAIL = 200;
const RESULT_LABELS: Record<string, string> = {
  nuevo: 'nuevo',
  actualizado: 'completado',
  omitido: 'alineado',
  fallido: 'con_error',
};
const RECEIVED_STATES = ['recibido', 'consolidado', 'en_transito', 'disponible', 'despachado', 'entregado'];

function pick(raw: any, keys: string[]) {
  for (const key of keys) {
    const value = raw?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
  }
  return '';
}

function pickNumber(raw: any, keys: string[]) {
  for (const key of keys) {
    const value = Number(raw?.[key]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

// Cada mayorista nombra sus campos a su manera: aquí se unifican. Solo se leen
// datos declarados por el mayorista; el estado real de la carga en el almacén es
// de TLEC CARGO y no se importa.
export function normalizeHistoryRecord(raw: any) {
  let tracking = cleanTracking(pick(raw, ['tracking_number', 'tracking', 'trackingNumber', 'numero_tracking', 'guia', 'numero_guia']));
  if (!tracking && Array.isArray(raw?.tracking_numbers)) {
    tracking = cleanTracking(raw.tracking_numbers.find((value: any) => String(value || '').trim()));
  }

  const shippingType = pick(raw, ['shipping_type', 'tipo_envio', 'tipo']).toLowerCase();
  const riskRaw = pick(raw, ['risk_category', 'tipo_carga', 'riesgo']).toLowerCase();

  return {
    tracking,
    label_code: pick(raw, ['label_code', 'label', 'etiqueta', 'codigo_etiqueta']),
    client_email: pick(raw, ['client_email', 'email', 'correo']).toLowerCase(),
    shipping_mark: pick(raw, ['shipping_mark', 'marca', 'mark']),
    shipping_type: shippingType.includes('aer') || shippingType === 'air' ? 'aereo' : 'maritimo',
    risk_category: riskRaw.includes('alto') || riskRaw.includes('high') ? 'alto_riesgo' : 'general',
    package_count: pickNumber(raw, ['package_count', 'packages', 'cantidad', 'bultos', 'paquetes']) || 1,
    description: truncate(pick(raw, ['description', 'descripcion', 'producto', 'detalle']), 500),
    invoice_url: pick(raw, ['invoice_url', 'factura_url']),
    product_image_url: pick(raw, ['product_image_url', 'imagen_producto', 'foto_producto']),
  };
}

function pickList(data: any) {
  if (Array.isArray(data)) return data;
  for (const key of ['items', 'prealerts', 'prealertas', 'packages', 'paquetes', 'results', 'data']) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
}

function pickCursor(data: any) {
  if (!data || Array.isArray(data)) return '';
  return String(data.next_cursor ?? data.nextCursor ?? data.next ?? data.cursor ?? '').trim();
}

async function fetchHistoryPage(url: string, key: string, cursor: string) {
  const params = new URLSearchParams();
  params.set('limit', String(PAGE_SIZE));
  if (cursor) params.set('cursor', cursor);
  const target = `${url}${url.includes('?') ? '&' : '?'}${params.toString()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(target, {
      method: 'GET',
      headers: key ? { 'x-api-key': key } : {},
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: false, records: [], next_cursor: '', has_more: false, error: `La app del mayorista respondió ${res.status}.` };
    }
    const data = await res.json().catch(() => null);
    return {
      ok: true,
      records: pickList(data),
      next_cursor: pickCursor(data),
      has_more: data?.has_more === true || data?.hasMore === true,
      error: null as string | null,
    };
  } catch (err: any) {
    const message = err?.name === 'AbortError'
      ? 'La app del mayorista no respondió a tiempo.'
      : (err?.message || 'No se pudo pedir el historial a la app del mayorista.');
    return { ok: false, records: [], next_cursor: '', has_more: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}

function isEmpty(value: any) {
  return value === undefined || value === null || String(value).trim() === '';
}

// Busca el registro de TLEC CARGO que corresponde a esta pre-alerta: primero por
// el tracking exacto (lo que exige el PRD) y, si no aparece, por su código de
// etiqueta. No se admiten variantes: una caja distinta no es el mismo envío.
async function findExisting(base44: any, tracking: string, labelCode: string) {
  if (tracking) {
    const rows = await base44.asServiceRole.entities.Package.filter({ tracking_number: tracking }, '-created_date', 1);
    if (rows?.[0]) return rows[0];
  }
  if (labelCode) {
    const rows = await base44.asServiceRole.entities.Package.filter({ label_code: labelCode }, '-created_date', 1);
    if (rows?.[0]) return rows[0];
  }
  return null;
}

// Lo que se completa de un registro que ya existía: solo campos que estaban
// vacíos. Nunca se pisa un valor existente, ni el estado, ni la recepción, ni las
// fotos del almacén.
function fillPatch(current: any, record: any, client: any) {
  const patch: Record<string, any> = {};
  const hasClient = !!String(current?.client_email || '').trim();

  if (isEmpty(current.description) && record.description) patch.description = record.description;

  if (!hasClient && client) {
    patch.client_email = client.email;
    patch.is_orphan = false;
  }

  if (isEmpty(current.shipping_mark)) {
    const mark = record.shipping_mark || client?.shipping_mark || '';
    if (mark) patch.shipping_mark = mark;
  }
  if (isEmpty(current.label_code) && record.label_code) patch.label_code = record.label_code;
  if (isEmpty(current.shipping_type) && record.shipping_type) patch.shipping_type = record.shipping_type;
  if (isEmpty(current.risk_category) && record.risk_category) patch.risk_category = record.risk_category;

  // La cantidad declarada solo se completa cuando no había ninguna: una cifra ya
  // registrada (o corregida en el almacén) no se rebaja ni se sube desde aquí.
  const declaredCount = Number(current?.package_count);
  if ((!Number.isFinite(declaredCount) || declaredCount <= 0) && record.package_count > 0) {
    patch.package_count = record.package_count;
  }

  if (isEmpty(current.invoice_url) && record.invoice_url) patch.invoice_url = record.invoice_url;
  if (isEmpty(current.product_image_url) && record.product_image_url) patch.product_image_url = record.product_image_url;

  return patch;
}

function createDeclaredFields(record: any) {
  return {
    tracking_number: record.tracking || '',
    ...(record.label_code ? { label_code: record.label_code } : {}),
    shipping_type: record.shipping_type || 'maritimo',
    risk_category: record.risk_category || 'general',
    package_count: Math.max(1, Number(record.package_count) || 1),
    ...(record.invoice_url ? { invoice_url: record.invoice_url } : {}),
    ...(record.product_image_url ? { product_image_url: record.product_image_url } : {}),
  };
}

// Una carga ya reconocida en el almacén (de China o en camino a Venezuela): es lo
// único que se le confirma al mayorista como recibido.
export function receivedInChina(pkg: any) {
  return RECEIVED_STATES.includes(String(pkg?.status || '')) || !!pkg?.received_date || !!pkg?.ve_recognized_date;
}

// Devuelve al mayorista las coincidencias de su historial que ya constan recibidas en
// el almacén y tienen su foto de recepción: se le manda el tracking, el cliente al que
// quedó asignada la carga y la foto, y su app marca esa carga como recibida en la
// cuenta de su cliente. Lo que no esté recibido o no tenga foto no se avisa como
// recepción. Cada envío queda registrado en el movimiento de la carga y, si no sale,
// queda pendiente para el reintento del corte diario.
async function confirmMatchesToWholesaler(base44: any, connection: any, matches: any[]) {
  const result = {
    enviados: 0,
    fallidos: 0,
    omitidos: 0,
    pendientes: 0,
    // Cómo quedó el aviso de cada carga, para el detalle del panel.
    por_paquete: {} as Record<string, any>,
    errores: [] as string[],
  };
  if (!matches.length) return result;

  if (!String(connection?.notify_url || '').trim() || connection?.notify_enabled === false) {
    result.pendientes = matches.length;
    for (const pkg of matches) {
      result.por_paquete[pkg.id] = { aviso: 'pendiente', fotos: receptionPhotos(pkg).length };
    }
    result.errores.push('El aviso al mayorista está desactivado o le falta su dirección: las coincidencias quedaron registradas sin devolver.');
    return result;
  }

  const receptions: any[] = [];
  for (const pkg of matches) {
    if (receptions.length >= MAX_NOTIFY_PER_RUN) {
      result.pendientes += 1;
      result.por_paquete[pkg.id] = { aviso: 'pendiente', fotos: receptionPhotos(pkg).length };
      continue;
    }
    try {
      const queued = await queueReceptionNotice(base44, pkg, connection, 'devuelta al alinear el historial de pre-alertas');
      if (!queued?.log_id) continue;
      if (queued.ya_avisado) {
        result.omitidos += 1;
        result.por_paquete[pkg.id] = {
          aviso: 'omitido',
          fotos: (queued.fotos || []).length,
          // Fecha del aviso que ya se le había entregado al mayorista.
          fecha: queued.notified_date || '',
        };
        continue;
      }
      receptions.push({
        package_id: pkg?.id || '',
        tracking: String(pkg?.tracking_number || ''),
        shipping_mark: pkg?.shipping_mark || '',
        // Titular del tracking en la app del mayorista: su cliente, no un usuario de
        // TLEC CARGO. Es a su cuenta a la que su app marca la carga como recibida.
        client_email: String(pkg?.client_email || '').trim() || queued.titular_email || '',
        client_external_id: queued.titular_external_id || '',
        estado: 'recibido',
        fecha: pkg?.received_date || pkg?.created_date || new Date().toISOString(),
        log_id: queued.log_id,
        fotos: queued.fotos,
      });
    } catch (err: any) {
      result.fallidos += 1;
      result.por_paquete[pkg.id] = { aviso: 'fallido', fotos: 0, mensaje: 'No se pudo preparar el aviso.' };
      if (result.errores.length < MAX_ERROR_SAMPLES) {
        result.errores.push(`${pkg?.tracking_number || 'sin tracking'}: ${truncate(err?.message || 'no se pudo preparar el aviso', 200)}`);
      }
    }
  }

  for (let i = 0; i < receptions.length; i += NOTIFY_BLOCK) {
    const block = receptions.slice(i, i + NOTIFY_BLOCK);
    const sent = await notifyReceptionBlock(base44, block, connection);
    if (sent?.enviado) {
      result.enviados += block.length;
      for (const item of block) {
        result.por_paquete[item.package_id] = { aviso: 'enviado', fotos: (item.fotos || []).length };
      }
      continue;
    }
    result.fallidos += block.length;
    for (const item of block) {
      result.por_paquete[item.package_id] = {
        aviso: 'fallido',
        fotos: (item.fotos || []).length,
        mensaje: sent?.mensaje || 'El aviso no se pudo entregar al mayorista.',
      };
    }
    if (result.errores.length < MAX_ERROR_SAMPLES) {
      result.errores.push(sent?.mensaje || 'No se pudo avisar al mayorista de las coincidencias.');
    }
  }

  return result;
}

// Registros que ese cliente ya tenía en TLEC CARGO con el mismo envío (su propia
// pre-alerta), para unificar en ellos en vez de dejar el mismo paquete dos veces.
async function findClientShipmentRecords(
  base44: any,
  { record, client, orphanId }: { record: any; client: any; orphanId: string },
) {
  const candidates = buildTrackingCandidates(record?.tracking || '');
  if (candidates.length === 0) return [];

  const matches = await findSameShipmentMatches(base44, {
    candidates,
    labelCode: record?.label_code || '',
    excludeId: orphanId,
  });

  const email = String(client?.email || '').trim().toLowerCase();
  return [...(matches.pending || []), ...(matches.received || [])].filter(
    (p: any) => String(p.client_email || '').trim().toLowerCase() === email,
  );
}

// Alinea un registro del historial con TLEC CARGO. Idempotente: repetir la misma
// importación no crea ni cambia nada la segunda vez.
export async function importHistoryRecord(base44: any, raw: any, connection: any = null) {
  const record = normalizeHistoryRecord(raw);
  const identity = record.tracking || record.label_code;

  if (!identity) {
    return { outcome: 'fallido', tracking: '', mensaje: 'El registro llegó sin tracking ni código de etiqueta.' };
  }

  const client = await findClientForNotice(base44, {
    client_email: record.client_email,
    shipping_mark: record.shipping_mark,
  });

  const existing = await findExisting(base44, record.tracking, record.label_code);

  if (!existing) {
    if (client) {
      const created = await base44.asServiceRole.entities.Package.create({
        ...createDeclaredFields(record),
        client_email: client.email,
        shipping_mark: client.shipping_mark || record.shipping_mark,
        description: record.description || 'Pre-alerta del historial del cliente mayorista',
        status: 'pre_alerta',
        is_orphan: false,
        reception_notes: 'Pre-alerta traída del historial del cliente mayorista',
      });
      return { outcome: 'nuevo', tracking: identity, package_id: created?.id || null, package: created || null, asignado: true, mensaje: 'Pre-alerta registrada en TLEC CARGO a nombre de su cliente.' };
    }

    // Sin cliente reconocido no se descarta nada: la carga queda como huérfano
    // para asignarla desde el panel, con los datos que trajo el mayorista.
    const orphan = await base44.asServiceRole.entities.Package.create({
      ...createDeclaredFields(record),
      shipping_mark: record.shipping_mark,
      description: record.description || 'Pre-alerta del historial del cliente mayorista',
      status: 'pre_alerta',
      is_orphan: true,
      reception_notes: 'Pre-alerta traída del historial del mayorista: su cliente todavía no se reconoce en TLEC CARGO.',
    });
    return { outcome: 'nuevo', tracking: identity, package_id: orphan?.id || null, package: orphan || null, asignado: false, mensaje: 'Pre-alerta guardada sin cliente asignado (huérfano), para revisarla.' };
  }

  let current = existing;
  let vinculado = false;

  // Si la carga ya estaba en el almacén sin cliente, esta pre-alerta la reclama
  // conservando su recepción y sus fotos. Si el cliente ya tenía registrado ese
  // mismo envío en TLEC CARGO (su propia pre-alerta), la carga sin titular se une a
  // ese registro en vez de quedar como un segundo paquete del mismo envío: el
  // registro del cliente queda recibido y se le suma la foto de la recepción.
  if (existing.is_orphan === true && !String(existing.client_email || '').trim() && client) {
    const propias = await findClientShipmentRecords(base44, { record, client, orphanId: existing.id });
    if (propias.length > 0) {
      const target = propias.find((p: any) => hasReceptionEvidence(p)) || propias[0];
      try {
        const unificado = await unifyOrphanIntoClientRecord({
          base44,
          orphan: existing,
          clientRecord: target,
          shippingMark: client.shipping_mark || record.shipping_mark,
          by: 'Historial del mayorista',
        });
        if (unificado?.package) {
          current = unificado.package;
          vinculado = true;
        }
      } catch (_) {
        // Si otro proceso la reclamó al mismo tiempo, se sigue con el llenado normal.
      }
    } else {
      try {
        const consolidado = await consolidateOrphan({
          base44,
          orphan: existing,
          claim: {
            client_email: client.email,
            shipping_mark: client.shipping_mark || record.shipping_mark,
            tracking_number: identity,
            ...(record.label_code ? { label_code: record.label_code } : {}),
            shipping_type: record.shipping_type,
            risk_category: record.risk_category,
            package_count: record.package_count,
            description: record.description,
          },
        });
        if (consolidado?.package) {
          current = consolidado.package;
          vinculado = true;
        }
      } catch (_) {
        // Si otro proceso la reclamó al mismo tiempo, se sigue con el llenado normal.
      }
    }
  }

  const patch = fillPatch(current, record, client);
  if (!Object.keys(patch).length) {
    return {
      outcome: vinculado ? 'actualizado' : 'omitido',
      tracking: identity,
      package_id: current?.id || null,
      package: current || null,
      asignado: vinculado,
      mensaje: vinculado
        ? 'La carga que estaba sin cliente quedó asignada a su dueño.'
        : 'Ya estaba alineado en TLEC CARGO: no se tocó.',
    };
  }

  const updated = await base44.asServiceRole.entities.Package.update(current.id, patch);
  return {
    outcome: 'actualizado',
    tracking: identity,
    package_id: updated?.id || current.id,
    package: updated || current,
    asignado: vinculado,
    mensaje: vinculado
      ? 'Se completaron datos que faltaban y la carga quedó asignada a su titular.'
      : 'Se completaron datos que faltaban (sin pisar lo que ya estaba).',
  };
}

// Pide y procesa el historial completo de ese mayorista. Devuelve el resumen de la
// corrida; los errores de un registro no detienen los demás.
export async function syncWholesalerHistoryConnection(base44: any, connection: any) {
  const now = new Date().toISOString();
  const summary: any = {
    id: connection?.id || null,
    name: connectionLabel(connection),
    key: connectionKeyOf(connection),
    pages: 0,
    total: 0,
    nuevos: 0,
    actualizados: 0,
    omitidos: 0,
    fallidos: 0,
    // Coincidencias ya recibidas que se le devolvieron al mayorista en esta corrida.
    avisos_enviados: 0,
    avisos_fallidos: 0,
    avisos_omitidos: 0,
    avisos_pendientes: 0,
    // Registros que quedaron con su titular asignado en esta corrida.
    asignados: 0,
    // Detalle por registro de la corrida, tal como lo muestra el panel.
    detalle: [] as any[],
    truncado: false,
    errores: [] as string[],
    mensaje: '',
  };

  if (connection?.history_sync_enabled === false) {
    summary.mensaje = 'La sincronización del historial está desactivada para este mayorista.';
    return summary;
  }

  const url = String(connection?.history_feed_url || '').trim();
  if (!url) {
    summary.mensaje = 'Falta la dirección para pedirle su historial de pre-alertas.';
    await updateConnection(base44, connection?.id, {
      last_history_run_date: now,
      last_history_status: 'error',
      last_history_message: truncate(summary.mensaje, 900),
    });
    await logWholesalerEvent(base44, {
      event_type: 'sync_fallido',
      result: 'error',
      detail: truncate(`Historial: ${summary.mensaje}`, 900),
      ...stampOf(connection),
    });
    return summary;
  }

  const seen = new Set<string>();
  // Cargas del historial que ya constan recibidas en el almacén, con su foto.
  const coincidencias: any[] = [];
  // Ficha de cada registro de la corrida, con su titular, su estado y su aviso.
  const detalle: any[] = [];
  const filaPorPaquete = new Map<string, any>();
  let cursor = '';
  let reachedLimit = false;

  while (summary.pages < MAX_PAGES && !reachedLimit) {
    const page = await fetchHistoryPage(url, outboundKeyFor(connection), cursor);

    if (!page.ok) {
      summary.mensaje = page.error;
      summary.errores.push(page.error || 'No se pudo consultar el historial.');
      await updateConnection(base44, connection?.id, {
        last_history_run_date: now,
        last_history_status: 'error',
        last_history_message: truncate(page.error || 'No se pudo consultar el historial.', 900),
      });
      await logWholesalerEvent(base44, {
        event_type: 'sync_fallido',
        result: 'error',
        detail: truncate(`Historial: ${page.error}`, 900),
        ...stampOf(connection),
      });
      return summary;
    }

    summary.pages += 1;

    for (const raw of page.records) {
      if (summary.total >= MAX_RECORDS) {
        reachedLimit = true;
        break;
      }

      const record = normalizeHistoryRecord(raw);
      const identity = record.tracking || record.label_code;
      if (identity) {
        if (seen.has(identity)) continue;
        seen.add(identity);
      }

      summary.total += 1;
      try {
        const result = await importHistoryRecord(base44, raw, connection);
        const pkg = result.package || null;
        // Coincidencia con una carga ya recibida en el almacén y con su foto: se le
        // devuelve al mayorista al terminar la corrida.
        const esCoincidencia = !!pkg && receivedInChina(pkg) && receptionPhotos(pkg).length > 0;
        if (esCoincidencia) coincidencias.push(pkg);

        // El titular de la carga se muestra tal como lo reconoce el mayorista: si esa
        // carga todavía no tiene cuenta en TLEC CARGO, su dueño en la app del
        // mayorista (por su Shipping Mark) es el titular que corresponde informar.
        const titular = (pkg && !String(pkg.client_email || '').trim())
          ? await trackingOwnerFor(base44, pkg, connection)
          : null;

        const fila = {
          tracking: String(pkg?.tracking_number || identity || ''),
          client_email: String(pkg?.client_email || '').trim() || String(titular?.email || ''),
          shipping_mark: String(pkg?.shipping_mark || ''),
          package_id: String(pkg?.id || ''),
          resultado: RESULT_LABELS[result.outcome] || 'con_error',
          estado: String(pkg?.status || ''),
          asignado: result.asignado === true,
          // Cómo quedó el aviso: se completa al terminar la corrida.
          aviso: !pkg ? 'no_aplica' : (!receivedInChina(pkg) ? 'no_recibido' : (esCoincidencia ? 'pendiente' : 'sin_foto')),
          fotos: pkg ? receptionPhotos(pkg).length : 0,
          // Fecha del aviso al mayorista: se completa al terminar la corrida.
          fecha: '',
          mensaje: truncate(result.mensaje || '', 300),
        };
        detalle.push(fila);
        if (pkg?.id) filaPorPaquete.set(pkg.id, fila);
        if (result.asignado === true) summary.asignados += 1;

        if (result.outcome === 'nuevo') summary.nuevos += 1;
        else if (result.outcome === 'actualizado') summary.actualizados += 1;
        else if (result.outcome === 'omitido') summary.omitidos += 1;
        else {
          summary.fallidos += 1;
          if (summary.errores.length < MAX_ERROR_SAMPLES) {
            summary.errores.push(`${identity || 'sin tracking'}: ${result.mensaje}`);
          }
        }
      } catch (err: any) {
        summary.fallidos += 1;
        const mensaje = truncate(err?.message || 'No se pudo procesar el registro.', 200);
        detalle.push({
          tracking: identity || '',
          client_email: '',
          shipping_mark: '',
          package_id: '',
          resultado: 'con_error',
          estado: '',
          asignado: false,
          aviso: 'no_aplica',
          fotos: 0,
          mensaje,
        });
        if (summary.errores.length < MAX_ERROR_SAMPLES) {
          summary.errores.push(`${identity || 'sin tracking'}: ${mensaje}`);
        }
      }
    }

    if (!page.next_cursor || page.next_cursor === cursor || page.has_more === false) break;
    cursor = page.next_cursor;
  }

  // Traída y alineada la información, se le devuelve al mayorista lo que ya consta
  // recibido: su tracking con la foto de la carga y su cliente.
  const avisos = await confirmMatchesToWholesaler(base44, connection, coincidencias);
  summary.avisos_enviados = avisos.enviados;
  summary.avisos_fallidos = avisos.fallidos;
  summary.avisos_omitidos = avisos.omitidos;
  summary.avisos_pendientes = avisos.pendientes;
  // Se completa en cada ficha cómo quedó su aviso al mayorista.
  for (const [packageId, info] of Object.entries(avisos.por_paquete as Record<string, any>)) {
    const fila = filaPorPaquete.get(packageId);
    if (!fila) continue;
    fila.aviso = info.aviso;
    fila.fotos = Number(info.fotos) || 0;
    fila.fecha = info.fecha || '';
    if (info.mensaje) fila.mensaje = truncate(`${fila.mensaje} ${info.mensaje}`.trim(), 300);
  }
  // Una carga ya recibida sin foto también queda pendiente de devolver.
  summary.avisos_pendientes += detalle.filter((fila) => fila.aviso === 'sin_foto').length;
  summary.detalle = detalle.slice(0, MAX_DETAIL);
  for (const error of avisos.errores) {
    if (summary.errores.length < MAX_ERROR_SAMPLES) summary.errores.push(error);
  }

  summary.truncado = reachedLimit || summary.pages >= MAX_PAGES;
  const devueltas = coincidencias.length
    ? ` Coincidencias ya recibidas devueltas al mayorista: ${summary.avisos_enviados} aviso(s) enviado(s)${summary.avisos_fallidos ? `, ${summary.avisos_fallidos} fallido(s)` : ''}${summary.avisos_pendientes ? `, ${summary.avisos_pendientes} se devuelven en la corrida siguiente` : ''}.`
    : '';
  summary.mensaje = `${summary.total} registro(s) del historial: ${summary.nuevos} nuevo(s), ${summary.actualizados} actualizado(s), ${summary.omitidos} ya alineado(s)${summary.fallidos ? `, ${summary.fallidos} con error` : ''}${summary.truncado ? ' (se alcanzó el tope de la corrida)' : ''}. ${summary.asignados} carga(s) quedaron con su titular asignado.${devueltas}`;

  await updateConnection(base44, connection?.id, {
    last_history_run_date: now,
    last_history_status: 'ok',
    last_history_message: truncate(summary.mensaje, 900),
    last_history_total: summary.total,
    last_history_new: summary.nuevos,
    last_history_updated: summary.actualizados,
    last_history_skipped: summary.omitidos,
    last_history_errors: summary.fallidos,
    last_history_pages: summary.pages,
    last_history_notified: summary.avisos_enviados,
    last_history_notify_failed: summary.avisos_fallidos,
    last_history_notify_pending: summary.avisos_pendientes,
    last_history_assigned: summary.asignados,
    last_history_detail: summary.detalle,
  });

  await logWholesalerEvent(base44, {
    event_type: 'historial_sincronizado',
    result: summary.nuevos || summary.actualizados ? 'alineado' : 'sin_cambios',
    detail: truncate(
      `${summary.mensaje}${summary.errores.length ? ` Errores: ${summary.errores.join(' · ')}` : ''}`,
      900,
    ),
    ...stampOf(connection),
  });

  return summary;
}