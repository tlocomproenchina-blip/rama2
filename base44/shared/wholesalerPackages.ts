// Operaciones sobre paquetes para la app de cada mayorista: consultar un
// tracking, marcarlo como recibido en el almacén de China y registrar
// pre-alertas reportadas. Nunca crea paquetes al consultar/recepcionar, nunca
// degrada un estado y deja cada movimiento marcado con el mayorista de origen.
import { connectionLabel, findConnectionById, logWholesalerEvent, stampOf, truncate, updateConnection } from './wholesalerCore.ts';
import { consolidateOrphan, linkOrphanToPrealert } from './orphanConsolidation.ts';

const SOURCE_LABEL = 'App del mayorista';
const MAX_TRACKINGS_PER_CALL = 50;

export function cleanTracking(value: any) {
  return String(value || '').trim().replace(/\s+/g, '');
}

// El escáner suele leer el sub-tracking (master + sufijo de caja), así que se
// prueban variantes quitando dígitos del final.
export function buildTrackingCandidates(tracking: string) {
  const removalOrder = [0, 3, 2, 4, 1, 5, 6];
  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const remove of removalOrder) {
    if (remove === 0) {
      if (!seen.has(tracking)) {
        seen.add(tracking);
        candidates.push(tracking);
      }
      continue;
    }
    if (tracking.length - remove < 5) continue;
    const candidate = tracking.slice(0, tracking.length - remove);
    if (!seen.has(candidate)) {
      seen.add(candidate);
      candidates.push(candidate);
    }
  }
  return candidates;
}

export async function findPackageByTracking(base44: any, tracking: string) {
  const clean = cleanTracking(tracking);
  if (!clean) return null;

  for (const candidate of buildTrackingCandidates(clean)) {
    const matches = await base44.asServiceRole.entities.Package.filter({ tracking_number: candidate }, '-created_date', 1);
    if (matches?.[0]) return matches[0];
  }

  const byLabel = await base44.asServiceRole.entities.Package.filter({ label_code: clean }, '-created_date', 1);
  return byLabel?.[0] || null;
}

// Fotos públicas del paquete, listas para que la app del mayorista las muestre:
// las del paquete recibido en China (hasta 3) y, si existe, la foto del producto
// de la pre-alerta. Se quitan las repetidas y se conserva el orden.
export function packagePhotos(pkg: any) {
  const urls = [
    ...(Array.isArray(pkg?.package_image_urls) ? pkg.package_image_urls : []),
    pkg?.package_image_url,
    pkg?.product_image_url,
  ];
  const seen = new Set<string>();
  const fotos: string[] = [];
  for (const raw of urls) {
    const url = String(raw || '').trim();
    if (url && !seen.has(url)) {
      seen.add(url);
      fotos.push(url);
    }
  }
  return fotos;
}

// Fotos de la recepción en el almacén de China: las que captura TLEC CARGO al
// recibir la carga. Son la confirmación visual que se le manda al mayorista, así
// que no se mezclan con la foto del producto que sube el cliente en su pre-alerta.
export function receptionPhotos(pkg: any) {
  const urls = [
    ...(Array.isArray(pkg?.package_image_urls) ? pkg.package_image_urls : []),
    pkg?.package_image_url,
  ];
  const seen = new Set<string>();
  const fotos: string[] = [];
  for (const raw of urls) {
    const url = String(raw || '').trim();
    if (url && !seen.has(url)) {
      seen.add(url);
      fotos.push(url);
    }
  }
  return fotos;
}

function describePackage(pkg: any) {
  const fotos = packagePhotos(pkg);
  return {
    huerfano: pkg?.is_orphan === true,
    estado: pkg?.status || null,
    shipping_mark: pkg?.shipping_mark || '',
    package_id: pkg?.id || null,
    fotos,
    fotos_count: fotos.length,
  };
}

// Cliente de TLEC CARGO al que corresponde el aviso del mayorista: se reconoce
// por su correo y, si no aparece, por su Shipping Mark.
export async function findClientForNotice(base44: any, { client_email, shipping_mark }: any) {
  const email = String(client_email || '').trim().toLowerCase();
  if (email) {
    const rows = await base44.asServiceRole.entities.User.filter({ email }, '-created_date', 1);
    if (rows?.[0]) return rows[0];
  }
  const mark = String(shipping_mark || '').trim();
  if (mark) {
    const rows = await base44.asServiceRole.entities.User.filter({ shipping_mark: mark }, '-created_date', 1);
    if (rows?.[0]) return rows[0];
  }
  return null;
}

// Solo lectura: dice si el tracking está registrado, sin modificar nada.
export async function checkTracking(base44: any, tracking: string, connection: any = null) {
  const clean = cleanTracking(tracking);
  if (!clean) {
    return { ok: false, tracking: '', resultado: 'error', registrado: false, fotos: [], fotos_count: 0, mensaje: 'Falta el tracking a consultar.' };
  }

  const pkg = await findPackageByTracking(base44, clean);
  const base = { ok: true, tracking: clean };

  if (!pkg) {
    await logWholesalerEvent(base44, {
      event_type: 'consulta',
      tracking_number: clean,
      result: 'no_registrado',
      detail: 'Consulta de solo lectura: el tracking no está registrado',
      ...stampOf(connection),
    });
    return {
      ...base,
      resultado: 'no_registrado',
      registrado: false,
      huerfano: false,
      estado: null,
      shipping_mark: '',
      fotos: [],
      fotos_count: 0,
      mensaje: 'El tracking no está registrado en TLEC CARGO.',
    };
  }

  await logWholesalerEvent(base44, {
    event_type: 'consulta',
    tracking_number: clean,
    client_email: pkg.client_email || '',
    shipping_mark: pkg.shipping_mark || '',
    package_id: pkg.id,
    result: pkg.status || 'registrado',
    detail: 'Consulta de solo lectura',
    ...stampOf(connection),
  });

  return {
    ...base,
    resultado: 'registrado',
    registrado: true,
    ...describePackage(pkg),
    mensaje: pkg.is_orphan === true
      ? 'Está registrado como huérfano (todavía sin cliente asignado).'
      : 'Está registrado en TLEC CARGO.',
  };
}

// Marca el tracking como recibido en el almacén de China (idempotente). Si el aviso
// del mayorista se adelantó a nuestro registro, la carga se guarda como una
// pre-alerta normal (con su cliente, si lo reconocemos) y se marca recibida: así
// ningún tracking que reporte el mayorista se queda por fuera de TLEC CARGO.
export async function receiveTracking(base44: any, tracking: string, connection: any = null, options: any = {}) {
  const clean = cleanTracking(tracking);
  const now = new Date().toISOString();
  const fecha = options?.fecha || now;
  const stamp = stampOf(connection);

  if (!clean) {
    return { tracking: '', resultado: 'error', creado: false, fotos: [], fotos_count: 0, mensaje: 'Falta el tracking: no se modificó nada.' };
  }

  let pkg = await findPackageByTracking(base44, clean);
  let creado = false;

  if (!pkg && options?.create_if_missing === true) {
    pkg = await createReportedPackage(base44, {
      tracking: clean,
      client_email: options?.client_email,
      shipping_mark: options?.shipping_mark,
      package_count: options?.package_count,
      connection,
    });
    creado = !!pkg;
  }

  // Un huérfano que ya estaba en el almacén se enlaza a la pre-alerta de su cliente
  // (mismo tracking exacto) cuando llega una recepción posterior: la carga queda con
  // su dueño sin que nadie la asigne a mano.
  if (pkg?.is_orphan === true && !String(pkg.client_email || '').trim()) {
    const linked = await linkOrphanToPrealert(base44, pkg);
    if (linked.linked && linked.package) pkg = linked.package;
  }

  // Si ese cliente todavía no había declarado la carga en TLEC CARGO (no hay
  // pre-alerta que la reclame), el propio aviso del mayorista —que sí trae el
  // correo o el Shipping Mark del cliente— le pone dueño al huérfano en el
  // momento, aunque la carga ya esté recibida: conserva su foto y sus datos de
  // recepción y deja de estar sin asignar, sin esperar a nadie.
  let claimed = false;
  if (pkg?.is_orphan === true && !String(pkg.client_email || '').trim() && (options?.client_email || options?.shipping_mark)) {
    const client = await findClientForNotice(base44, {
      client_email: options?.client_email,
      shipping_mark: options?.shipping_mark,
    });
    if (client) {
      try {
        const consolidado = await consolidateOrphan({
          base44,
          orphan: pkg,
          claim: {
            client_email: client.email,
            shipping_mark: client.shipping_mark || options?.shipping_mark || '',
            tracking_number: clean,
            package_count: options?.package_count,
          },
        });
        if (consolidado?.package) {
          pkg = consolidado.package;
          claimed = true;
        }
      } catch (_) {
        // Si otro proceso lo reclamó en el mismo instante, se sigue con el enlace normal.
      }
    }
  }

  if (!pkg) {
    await logWholesalerEvent(base44, {
      event_type: 'no_registrado',
      tracking_number: clean,
      result: 'no_registrado',
      detail: 'El tracking no está registrado: no se creó nada',
      ...stamp,
    });
    return { tracking: clean, resultado: 'no_registrado', creado: false, estado: null, huerfano: false, shipping_mark: '', fotos: [], fotos_count: 0, mensaje: 'El tracking no está registrado en TLEC CARGO: no se creó nada.' };
  }

  const pendingReception = pkg.status === 'pre_alerta' || (pkg.is_orphan === true && !pkg.received_date);

  if (!pendingReception) {
    await logWholesalerEvent(base44, {
      event_type: 'recepcion_existente',
      tracking_number: clean,
      client_email: pkg.client_email || '',
      shipping_mark: pkg.shipping_mark || '',
      package_id: pkg.id,
      result: claimed ? 'asignado' : (pkg.status || 'ya_registrado'),
      detail: claimed
        ? `Carga que estaba sin cliente en el almacén: quedó asignada al cliente ${pkg.client_email}`
        : (creado
          ? 'El tracking se guardó como pre-alerta y ya quedaba recibido'
          : 'Ya estaba registrado: no se modificó ni se devolvió de estado'),
      ...stamp,
    });
    return {
      tracking: clean,
      resultado: 'ya_registrado',
      creado,
      asignado: claimed,
      client_email: pkg.client_email || '',
      ...describePackage(pkg),
      foto_pendiente: receptionPhotos(pkg).length === 0,
      mensaje: claimed
        ? `La carga ya estaba recibida en el almacén: quedó asignada al cliente ${pkg.client_email}.`
        : `Ya estaba registrado con estado "${pkg.status}": no se modificó nada.`,
    };
  }

  const updated = await base44.asServiceRole.entities.Package.update(pkg.id, {
    status: 'recibido',
    received_date: fecha,
    received_by: SOURCE_LABEL,
  });

  const log = await logWholesalerEvent(base44, {
    event_type: 'recepcion',
    tracking_number: clean,
    client_email: updated?.client_email || pkg.client_email || '',
    shipping_mark: updated?.shipping_mark || pkg.shipping_mark || '',
    package_id: pkg.id,
    result: 'recibido',
    detail: creado
      ? 'Tracking reportado por el mayorista que no estaba registrado: se guardó como pre-alerta y se marcó recibido'
      : 'Recepcionado desde la app del mayorista',
    notify_pending: true,
    ...stamp,
  });

  await updateConnection(base44, connection?.id, {
    last_reception_date: now,
    last_reception_tracking: clean,
    last_reception_status: 'recibido',
  });

  const fotos = receptionPhotos(updated || pkg);

  return {
    tracking: clean,
    resultado: 'recibido',
    creado,
    estado: 'recibido',
    client_email: updated?.client_email || pkg.client_email || '',
    huerfano: (updated?.is_orphan ?? pkg.is_orphan) === true,
    shipping_mark: updated?.shipping_mark || pkg.shipping_mark || '',
    package_id: pkg.id,
    fecha,
    log_id: log?.id || null,
    fotos,
    fotos_count: fotos.length,
    foto_pendiente: fotos.length === 0,
    mensaje: creado
      ? 'El tracking no estaba registrado: se guardó como pre-alerta y se marcó como recibido en el almacén de China.'
      : 'Marcado como recibido en el almacén de China.',
  };
}

// Recepción de un bloque de trackings (una sola llamada de la app del mayorista).
export async function receiveTrackingBlock(base44: any, trackings: any, connection: any = null, defaults: any = {}) {
  const list = Array.isArray(trackings) ? trackings : [trackings];
  const items: any[] = [];
  const seen = new Set<string>();

  for (const raw of list) {
    const isText = typeof raw === 'string';
    const tracking = cleanTracking(isText ? raw : (raw?.tracking ?? raw?.tracking_number));
    if (!tracking || seen.has(tracking)) continue;
    seen.add(tracking);
    items.push({
      tracking,
      client_email: (isText ? '' : raw?.client_email) || defaults?.client_email || '',
      shipping_mark: (isText ? '' : raw?.shipping_mark) || defaults?.shipping_mark || '',
      package_count: isText ? null : raw?.package_count,
      fecha: (isText ? null : (raw?.fecha || raw?.received_date)) || defaults?.fecha || null,
    });
    if (items.length >= MAX_TRACKINGS_PER_CALL) break;
  }

  const resultados: any[] = [];
  for (const item of items) {
    try {
      resultados.push(await receiveTracking(base44, item.tracking, connection, {
        create_if_missing: true,
        fecha: item.fecha || undefined,
        client_email: item.client_email,
        shipping_mark: item.shipping_mark,
        package_count: item.package_count,
      }));
    } catch (err: any) {
      resultados.push({ tracking: item.tracking, resultado: 'error', creado: false, mensaje: truncate(err?.message || 'No se pudo procesar el tracking.', 300) });
    }
  }

  const recibidos = resultados.filter((r) => r.resultado === 'recibido');
  const yaRegistrados = resultados.filter((r) => r.resultado === 'ya_registrado');
  const noRegistrados = resultados.filter((r) => r.resultado === 'no_registrado');

  return {
    resultados,
    recibidos,
    yaRegistrados,
    noRegistrados,
    creados: resultados.filter((r) => r.creado === true).length,
    sinFoto: resultados.filter((r) => r.foto_pendiente === true).length,
  };
}

// Registra una pre-alerta reportada por la app del mayorista a nombre de su cliente.
export async function reportPrealert(base44: any, payload: any, connection: any = null) {
  const tracking = cleanTracking(payload?.tracking ?? payload?.tracking_number);
  const labelCode = String(payload?.label_code || '').trim();
  const clientEmail = String(payload?.client_email || '').trim().toLowerCase();
  const shippingMark = String(payload?.shipping_mark || '').trim();
  const shippingType = payload?.shipping_type === 'aereo' ? 'aereo' : 'maritimo';
  const riskCategory = payload?.risk_category === 'alto_riesgo' ? 'alto_riesgo' : 'general';
  const packageCount = Math.max(1, Number(payload?.package_count) || 1);
  const description = truncate(payload?.description || 'Pre-alerta reportada por el cliente mayorista', 500);
  const stamp = stampOf(connection);

  if (!tracking && !labelCode) {
    return { ok: false, resultado: 'error', mensaje: 'Falta el tracking o el código de etiqueta.' };
  }

  const client = await findClientForNotice(base44, { client_email: clientEmail, shipping_mark: shippingMark });

  if (!client) {
    await logWholesalerEvent(base44, {
      event_type: 'prealerta_rechazada',
      tracking_number: tracking || labelCode,
      client_email: clientEmail,
      shipping_mark: shippingMark,
      result: 'cliente_no_encontrado',
      detail: 'El cliente indicado no existe en TLEC CARGO',
      ...stamp,
    });
    return {
      ok: false,
      resultado: 'cliente_no_encontrado',
      mensaje: 'Ese cliente no existe en TLEC CARGO: la pre-alerta no se registró. Verifica el correo o el shipping mark.',
    };
  }

  // Primero el tracking exacto: solo una coincidencia exacta puede reclamar un
  // huérfano. Después se admiten las variantes del escáner (el tracking con el
  // sufijo de caja recortado) para no dar de alta un duplicado del mismo envío.
  const exactos: any[] = tracking
    ? await base44.asServiceRole.entities.Package.filter({ tracking_number: tracking }, '-created_date', 5)
    : [];
  const encontrados: any[] = [...exactos];
  const vistos = new Set(exactos.map((row) => row.id));
  const sumar = (rows: any[]) => {
    for (const row of rows || []) {
      if (row?.id && !vistos.has(row.id)) {
        vistos.add(row.id);
        encontrados.push(row);
      }
    }
  };
  if (tracking) {
    for (const candidato of buildTrackingCandidates(tracking).slice(1)) {
      sumar(await base44.asServiceRole.entities.Package.filter({ tracking_number: candidato }, '-created_date', 5));
    }
  }
  if (labelCode) {
    sumar(await base44.asServiceRole.entities.Package.filter({ label_code: labelCode }, '-created_date', 5));
  }

  // El mismo envío puede haber llegado antes sin pre-alerta y quedar registrado
  // como huérfano: si todavía no tiene cliente, esta pre-alerta lo reclama en vez
  // de quedarse como duplicado sin asignar. La carga recibida no se toca: manda el
  // registro del almacén, con sus fotos y sus datos de recepción.
  const huerfano = exactos.find((row) => row?.is_orphan === true && !String(row.client_email || '').trim());
  if (huerfano) {
    try {
      const consolidado = await consolidateOrphan({
        base44,
        orphan: huerfano,
        claim: {
          client_email: client.email,
          shipping_mark: client.shipping_mark || shippingMark,
          tracking_number: tracking || labelCode,
          ...(labelCode ? { label_code: labelCode } : {}),
          shipping_type: shippingType,
          risk_category: riskCategory,
          package_count: packageCount,
          description,
        },
      });
      const vinculado = consolidado?.package || huerfano;
      await logWholesalerEvent(base44, {
        event_type: 'prealerta_reportada',
        tracking_number: tracking || labelCode,
        client_email: client.email,
        shipping_mark: vinculado.shipping_mark || client.shipping_mark || shippingMark,
        package_id: vinculado.id,
        result: 'vinculada',
        detail: 'Pre-alerta vinculada al paquete huérfano que ya estaba registrado con ese tracking',
        ...stamp,
      });
      return {
        ok: true,
        resultado: 'vinculada',
        package_id: vinculado.id,
        shipping_mark: vinculado.shipping_mark || client.shipping_mark || shippingMark,
        mensaje: 'La carga ya estaba recibida en el almacén: la pre-alerta quedó vinculada a su registro, sin duplicarlo.',
      };
    } catch (_) {
      // Si otro proceso lo reclamó en el mismo momento, no se toca un envío ya
      // asignado: se sigue con el conflicto normal de abajo.
    }
  }

  const existing = encontrados[0] || null;

  if (existing) {
    const registrado = String(existing.tracking_number || '').trim();
    const esExacto = !tracking || registrado === tracking;
    const motivo = esExacto
      ? 'Ese tracking ya estaba registrado: no se tocó'
      : `El mismo envío ya estaba registrado con el tracking ${registrado}: no se tocó`;
    await logWholesalerEvent(base44, {
      event_type: 'prealerta_duplicada',
      tracking_number: tracking || labelCode,
      client_email: existing.client_email || clientEmail,
      shipping_mark: existing.shipping_mark || '',
      package_id: existing.id,
      result: existing.status || 'duplicado',
      detail: truncate(motivo, 900),
      ...stamp,
    });
    return {
      ok: false,
      resultado: 'duplicado',
      tracking_number: registrado,
      mensaje: esExacto
        ? 'Ese tracking ya estaba registrado en TLEC CARGO: no se tocó nada.'
        : `El mismo envío ya estaba registrado con el tracking ${registrado}: no se tocó nada.`,
    };
  }

  const created = await base44.asServiceRole.entities.Package.create({
    tracking_number: tracking || '',
    client_email: client.email,
    shipping_mark: client.shipping_mark || shippingMark,
    ...(labelCode ? { label_code: labelCode } : {}),
    shipping_type: shippingType,
    risk_category: riskCategory,
    package_count: packageCount,
    description,
    status: 'pre_alerta',
    is_orphan: false,
    reception_notes: 'Pre-alerta reportada por el cliente mayorista (app externa)',
  });

  await logWholesalerEvent(base44, {
    event_type: 'prealerta_reportada',
    tracking_number: tracking || labelCode,
    client_email: client.email,
    shipping_mark: created?.shipping_mark || '',
    package_id: created?.id || null,
    result: 'pre_alerta',
    detail: 'Pre-alerta registrada desde la app del mayorista',
    ...stamp,
  });

  return {
    ok: true,
    resultado: 'registrada',
    package_id: created?.id || null,
    shipping_mark: created?.shipping_mark || '',
    mensaje: 'Pre-alerta registrada en TLEC CARGO.',
  };
}

// ---------------------------------------------------------------------------
// Cargas que el mayorista reporta y todavía no están en TLEC CARGO

// Da de alta un tracking reportado por el mayorista que no existía en el sistema:
// con su cliente reconocido queda como una pre-alerta normal a su nombre; si el
// cliente no se reconoce no se descarta nada, la carga queda como huérfano para
// asignarla desde el panel de huérfanos.
async function createReportedPackage(base44: any, { tracking, client_email, shipping_mark, package_count, connection }: any) {
  const prealerta = await reportPrealert(base44, {
    tracking,
    client_email,
    shipping_mark,
    package_count,
    description: 'Carga reportada por el mayorista',
  }, connection);

  if (prealerta?.resultado === 'duplicado') return await findPackageByTracking(base44, tracking);

  if (prealerta?.package_id) {
    const rows = await base44.asServiceRole.entities.Package.filter({ id: prealerta.package_id }, '-created_date', 1);
    if (rows?.[0]) return rows[0];
  }

  if (prealerta?.resultado !== 'cliente_no_encontrado') return null;

  return await base44.asServiceRole.entities.Package.create({
    tracking_number: tracking,
    shipping_mark: String(shipping_mark || '').trim(),
    shipping_type: 'maritimo',
    risk_category: 'general',
    package_count: Math.max(1, Number(package_count) || 1),
    description: 'Carga reportada por el mayorista',
    status: 'pre_alerta',
    is_orphan: true,
    reception_notes: 'El mayorista reportó esta carga y su cliente todavía no se reconoce: falta asignarla desde el panel de huérfanos.',
  });
}

// A qué mayorista corresponde una carga: por sus movimientos registrados y, si no
// hay ninguno, por el mayorista del que vino su cliente. Sin ese vínculo no se
// avisa a nadie: no se inventan avisos para cargas de otros orígenes.
export async function wholesalerTargetForPackage(base44: any, pkg: any) {
  const tracking = String(pkg?.tracking_number || '').trim();
  if (tracking) {
    const logs = await base44.asServiceRole.entities.WholesalerLog
      .filter({ tracking_number: tracking }, '-event_date', 10)
      .catch(() => []);
    const key = String(logs?.find((log: any) => log?.wholesaler_key)?.wholesaler_key || '').trim();
    if (key) return await findConnectionById(base44, key);
  }

  const email = String(pkg?.client_email || '').trim().toLowerCase();
  if (email) {
    const rows = await base44.asServiceRole.entities.WholesalerClient
      .filter({ email }, '-fetched_date', 5)
      .catch(() => []);
    const key = String(rows?.[0]?.wholesaler_key || '').trim();
    if (key) return await findConnectionById(base44, key);
  }

  // El Shipping Mark del cliente identifica a su mayorista aunque la carga haya
  // entrado sin su aviso previo (la escaneó el almacén y quedó huérfana): es la
  // misma marca con la que ese mayorista reportó a su cliente, así que su
  // confirmación de recepción no se pierde por falta de historial en el tracking.
  const mark = String(pkg?.shipping_mark || '').trim();
  if (mark) {
    const rows = await base44.asServiceRole.entities.WholesalerClient
      .filter({ shipping_mark: mark }, '-fetched_date', 5)
      .catch(() => []);
    const key = String(rows?.[0]?.wholesaler_key || '').trim();
    if (key) return await findConnectionById(base44, key);
  }

  return null;
}

// Deja listo el aviso de recepción de una carga ya registrada, con la foto que
// capturó TLEC CARGO en el almacén: se usa cuando el tracking se vincula a su
// cliente después de haber entrado, para que el mayorista reciba la confirmación
// visual. Si el aviso ya se le había mandado completo, no se repite.
export async function queueReceptionNotice(base44: any, pkg: any, connection: any, by = '') {
  if (!pkg?.id || !connection?.id) return null;

  const fotos = receptionPhotos(pkg);
  const existing = await base44.asServiceRole.entities.WholesalerLog
    .filter({ event_type: 'recepcion', package_id: pkg.id }, '-event_date', 5)
    .catch(() => []);
  const log = existing?.[0] || null;

  // Un aviso ya entregado solo se repite cuando ahora hay algo que antes no existía:
  // la foto de la carga o el cliente al que quedó asignada. Un aviso que salió sin
  // cliente no le permite a su app marcar la carga en la cuenta de nadie, así que al
  // asignarla se le vuelve a mandar el tracking ya con su dueño y con la foto.
  const clienteConocido = !!String(pkg?.client_email || '').trim();
  const clienteEnviado = !!String(log?.client_email || '').trim();
  const yaAvisado = !!log?.notified_date && log?.photo_pending !== true
    && (!clienteConocido || clienteEnviado);
  if (yaAvisado) {
    return {
      log_id: log.id,
      ya_avisado: true,
      aviso_existente: true,
      fotos,
      fotos_count: fotos.length,
      foto_pendiente: fotos.length === 0,
    };
  }

  const detalle = `Recepción en el almacén confirmada al mayorista${pkg.client_email ? ` para ${pkg.client_email}` : ''}${by ? ` (${by})` : ''}`;
  const patch: Record<string, any> = {
    tracking_number: pkg.tracking_number || '',
    client_email: pkg.client_email || '',
    shipping_mark: pkg.shipping_mark || '',
    package_id: pkg.id,
    result: pkg.status || 'recibido',
    detail: truncate(detalle, 900),
    photo_pending: fotos.length === 0,
    // Un aviso pendiente se reintenta; si ya había salido, solo se repite cuando
    // hay algo nuevo que mandar: la foto de la carga.
    notify_pending: true,
    notified_date: fotos.length > 0 ? null : (log?.notified_date || null),
  };

  const saved = log
    ? await base44.asServiceRole.entities.WholesalerLog.update(log.id, patch)
    : await logWholesalerEvent(base44, { event_type: 'recepcion', ...patch, ...stampOf(connection) });

  return {
    log_id: (saved || log)?.id || null,
    ya_avisado: false,
    aviso_existente: !!log,
    fotos,
    fotos_count: fotos.length,
    foto_pendiente: fotos.length === 0,
  };
}