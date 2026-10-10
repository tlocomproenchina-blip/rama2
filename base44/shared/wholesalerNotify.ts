// Aviso a la app de cada mayorista cuando su carga se recibe en el almacén de
// China. La dirección y la clave salen siempre de su conexión guardada (nunca de
// quien llama) y los envíos fallidos quedan pendientes para reintentar en el
// corte siguiente. Cada intento queda anotado en el movimiento de la recepción
// (resultado, fecha y cuántas fotos iban en ese envío), que es lo que alimenta el
// historial de envíos al mayorista del panel.
import {
  DEFAULT_CONNECTION_KEY,
  appFunctionUrl,
  connectionKeyOf,
  connectionLabel,
  getPrimaryConnection,
  logWholesalerEvent,
  outboundKeyFor,
  truncate,
  updateConnection,
} from './wholesalerCore.ts';
import { registerConnectionResult } from './wholesalerHealth.ts';
import { receptionPhotosByPackageId } from './wholesalerOutbound.ts';
import { queueReceptionNotice, receptionPhotos, wholesalerTargetForPackage } from './wholesalerPackages.ts';

const MAX_ATTEMPTS = 5;
const MAX_HISTORY = 10;
const TIMEOUT_MS = 15000;

// La respuesta de la app del mayorista se lee, no se da por hecha: su confirmación
// (cuántas cargas actualizó) queda anotada en el historial del envío, y un aviso que
// su webhook rechaza no se marca entregado: queda pendiente para reintentar.
function wholesalerAnswer(status: number, raw: string) {
  const text = String(raw || '').trim();
  if (!text) return { ok: true, confirmation: '', error: null, reachable: true };

  let body: any = null;
  try {
    body = JSON.parse(text);
  } catch (_) {
    // Respuesta que no es JSON: vale como acuse, sin confirmación que anotar.
    return { ok: true, confirmation: truncate(text, 200), error: null, reachable: true };
  }
  if (!body || typeof body !== 'object') return { ok: true, confirmation: '', error: null, reachable: true };

  const rawMessage = [body.error, body.mensaje, body.message, body.detalle].find((v) => typeof v === 'string' && v.trim());
  const mensaje = rawMessage ? truncate(rawMessage, 200) : '';

  if (body.ok === false || body.success === false || body.error) {
    return {
      ok: false,
      confirmation: '',
      reachable: true,
      error: mensaje || `la app del mayorista no aceptó el aviso (respondió ${status})`,
    };
  }

  const partes = ['actualizados', 'updated', 'recibidos', 'received', 'total']
    .filter((key) => body[key] !== undefined && body[key] !== null)
    .map((key) => `${key}: ${body[key]}`);
  return { ok: true, confirmation: truncate(partes.join(', '), 200), error: null, reachable: true };
}

async function postToWholesaler(url: string, key: string, payload: any) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { 'x-api-key': key } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      // Un error de su servidor (5xx) cuenta como conexión caída; un rechazo del
      // aviso (4xx) no: el aviso queda pendiente y se reintenta con los datos al día.
      return {
        ok: false,
        confirmation: '',
        reachable: res.status < 500,
        error: `la app del mayorista respondió ${res.status}${truncate(text, 150) ? `: ${truncate(text, 150)}` : ''}`,
      };
    }
    return wholesalerAnswer(res.status, text);
  } catch (err: any) {
    const message = err?.name === 'AbortError' ? 'la app del mayorista no respondió a tiempo' : (err?.message || 'no se pudo conectar');
    return { ok: false, confirmation: '', reachable: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}

function buildPayload(receptions: any[]) {
  return {
    evento: 'carga_recibida_en_china',
    fecha: new Date().toISOString(),
    total: receptions.length,
    paquetes: receptions.map((r) => {
      const fotos = Array.isArray(r.fotos) ? r.fotos : [];
      return {
        tracking: r.tracking,
        shipping_mark: r.shipping_mark || '',
        // Cliente al que quedó asignada la carga en TLEC CARGO: es con lo que la app
        // del mayorista marca el envío como recibido en la cuenta de su cliente.
        client_email: String(r.client_email || '').trim().toLowerCase(),
        client_external_id: r.client_external_id || '',
        estado: r.estado || 'recibido',
        recibido: true,
        fecha: r.fecha || new Date().toISOString(),
        huerfano: r.huerfano === true,
        // Direcciones públicas listas para mostrar en la app del mayorista.
        foto: fotos[0] || '',
        fotos,
      };
    }),
  };
}

// Los movimientos de las recepciones que van en este aviso: es donde queda el
// estado por paquete (enviado, pendiente o fallido) y su historial de intentos.
async function receptionLogs(base44: any, receptions: any[]) {
  const ids = Array.from(new Set(receptions.map((r) => r?.log_id).filter(Boolean)));
  if (!ids.length) return [];

  const rows = await base44.asServiceRole.entities.WholesalerLog
    .filter({ id: { $in: ids } }, '-event_date', 200)
    .catch(() => []);

  return (rows && rows.length) ? rows : ids.map((id) => ({ id }));
}

// Identidad del cliente en la app del mayorista: su identificador externo viaja en
// el aviso para que esa app encuentre la cuenta del cliente al que quedó asignada la
// carga, en vez de recibir solo el tracking sin saber a quién pertenece.
async function clientIdentities(base44: any, receptions: any[]) {
  const emails = Array.from(new Set(
    (receptions || []).map((r) => String(r?.client_email || '').trim().toLowerCase()).filter(Boolean),
  ));
  const map: Record<string, any> = {};
  if (!emails.length) return map;

  try {
    const rows = await base44.asServiceRole.entities.WholesalerClient
      .filter({ email: { $in: emails } }, '-fetched_date', 200);
    for (const row of rows || []) {
      const email = String(row?.email || '').trim().toLowerCase();
      if (email && !map[email]) map[email] = row;
    }
  } catch (_) {}
  return map;
}

// Una carga asignada solo sale de la lista de Paquetes Huérfanos cuando ya consta
// recibida en el almacén y su foto de recepción salió al mayorista. Si falta
// cualquiera de las dos cosas, el paquete sigue ahí para seguimiento.
export function noticeDeliveredWithPhoto(aviso: any) {
  if (!aviso) return false;
  const confirmado = aviso.enviado === true || aviso.ya_avisado === true;
  return confirmado && aviso.foto_pendiente !== true;
}

// Marca (o apaga) el seguimiento dentro de la lista de huérfanos de esa carga.
export async function setOrphanFollowup(base44: any, packageId: string, pending: boolean) {
  if (!packageId) return;
  try {
    await base44.asServiceRole.entities.Package.update(packageId, { orphan_pending_reception: pending });
  } catch (_) {}
}

// Deja constancia del intento de entrega en el movimiento de cada paquete
// avisado: solo se marca entregado cuando la app del mayorista confirmó, y un
// aviso que sale sin la foto de la carga no se da por completo.
export async function recordNotifyAttempt(base44: any, logs: any[], { ok, detail, fotosByLogId, fotoFaltanteByLogId }: any) {
  const now = new Date().toISOString();
  // Cargas cuyo aviso salió completo (con su foto): ya pueden salir de la lista de
  // huérfanos.
  const deliveredIds: string[] = [];

  for (const log of logs || []) {
    if (!log?.id) continue;
    const sinFoto = ok === true && fotoFaltanteByLogId?.[log.id] === true;
    if (ok && !sinFoto && log.package_id) deliveredIds.push(String(log.package_id));
    const attempts = (Number(log.notify_attempts) || 0) + (ok ? 0 : 1);
    const entry = {
      date: now,
      result: ok ? 'enviado' : 'fallido',
      detail: truncate(sinFoto ? `${detail} · sin foto de recepción` : detail, 300),
      fotos_count: Number(fotosByLogId?.[log.id]) || 0,
    };
    const history = [...(Array.isArray(log.notify_history) ? log.notify_history : []), entry].slice(-MAX_HISTORY);

    try {
      await base44.asServiceRole.entities.WholesalerLog.update(log.id, {
        // Falta la foto de la carga: el aviso sigue pendiente hasta poder mandarla.
        notify_pending: ok ? sinFoto : attempts < MAX_ATTEMPTS,
        photo_pending: sinFoto,
        notify_attempts: attempts,
        notify_history: history,
        ...(ok ? { notified_date: now } : {}),
      });
    } catch (_) {}
  }

  if (deliveredIds.length) {
    try {
      await base44.asServiceRole.entities.Package.updateMany(
        { id: { $in: deliveredIds }, orphan_pending_reception: true },
        { $set: { orphan_pending_reception: false } },
      );
    } catch (_) {}
  }
}

function pendingOfConnection(base44: any, connection: any) {
  return base44.asServiceRole.entities.WholesalerLog
    .filter({ event_type: 'recepcion', notify_pending: true }, '-event_date', 200)
    .then((rows: any[]) => (rows || []).filter(
      (log: any) => (String(log.wholesaler_key || '').trim() || DEFAULT_CONNECTION_KEY) === connectionKeyOf(connection)
    ))
    .catch(() => []);
}

// Avisa a un mayorista concreto que su carga llegó al almacén de China.
export async function notifyReceptionBlock(base44: any, receptions: any[], connection: any) {
  if (!receptions?.length) return { enviado: false, mensaje: 'No hay recepciones que avisar.' };
  if (!connection?.id) {
    return {
      enviado: false,
      configurado: false,
      mensaje: 'No se encontró la conexión de ese mayorista: la recepción queda registrada y pendiente de avisar.',
    };
  }

  const url = appFunctionUrl(connection?.notify_url);
  if (connection?.notify_enabled === false || !url) {
    return {
      enviado: false,
      configurado: false,
      mensaje: `El aviso automático de ${connectionLabel(connection)} está desactivado o falta su dirección: la recepción queda registrada y pendiente de avisar.`,
    };
  }

  const fotosByLogId: Record<string, number> = {};
  const fotoFaltanteByLogId: Record<string, boolean> = {};
  for (const r of receptions) {
    if (!r?.log_id) continue;
    const count = Array.isArray(r.fotos) ? r.fotos.length : 0;
    fotosByLogId[r.log_id] = count;
    fotoFaltanteByLogId[r.log_id] = count === 0;
  }
  const sinFoto = Object.values(fotoFaltanteByLogId).filter(Boolean).length;

  const key = outboundKeyFor(connection);
  const identities = await clientIdentities(base44, receptions);
  const payload = buildPayload(receptions.map((r) => ({
    ...r,
    client_external_id: identities[String(r?.client_email || '').trim().toLowerCase()]?.external_id || '',
  })));
  const result = await postToWholesaler(url, key, payload);
  const now = new Date().toISOString();
  const logs = await receptionLogs(base44, receptions);

  if (result.ok) {
    const entregado = `${receptions.length} paquete(s) avisados a la app del mayorista`;
    // Lo que contestó su app (por ejemplo "actualizados: 1") queda en el historial:
    // así se ve que el aviso no solo salió, sino que su app lo aplicó.
    const confirmado = result.confirmation ? ` · su app confirmó: ${result.confirmation}` : '';
    const detalle = `${entregado}${confirmado}${sinFoto > 0 ? `; ${sinFoto} sin foto de recepción (queda pendiente enviarla)` : ''}`;

    await recordNotifyAttempt(base44, logs, {
      ok: true,
      detail: `${entregado}${confirmado}`,
      fotosByLogId,
      fotoFaltanteByLogId,
    });
    await updateConnection(base44, connection.id, {
      last_notify_date: now,
      last_notify_status: 'enviado',
      last_notify_message: truncate(`Aviso enviado: ${detalle}.`, 900),
    });
    await logWholesalerEvent(base44, {
      event_type: 'aviso_enviado',
      tracking_number: truncate(receptions.map((r) => r.tracking).join(', '), 250),
      result: 'enviado',
      detail: truncate(detalle, 900),
      wholesaler_key: connectionKeyOf(connection),
      wholesaler_name: connectionLabel(connection),
    });
    return {
      enviado: true,
      sin_foto: sinFoto,
      mensaje: `Aviso enviado al mayorista (${receptions.length} paquete(s))${sinFoto > 0 ? `. ${sinFoto} sin foto de recepción: queda pendiente enviarla` : ''}.`,
    };
  }

  await updateConnection(base44, connection.id, {
    last_notify_date: now,
    last_notify_status: 'fallido',
    last_notify_message: truncate(`No se pudo avisar al mayorista: ${result.error}`, 900),
  });
  await logWholesalerEvent(base44, {
    event_type: 'aviso_fallido',
    tracking_number: truncate(receptions.map((r) => r.tracking).join(', '), 250),
    result: 'fallido',
    detail: truncate(result.error, 900),
    wholesaler_key: connectionKeyOf(connection),
    wholesaler_name: connectionLabel(connection),
  });
  await recordNotifyAttempt(base44, logs, {
    ok: false,
    detail: `No se pudo avisar al mayorista: ${result.error}`,
    fotosByLogId,
    fotoFaltanteByLogId,
  });
  // Un aviso que no sale cuenta como conexión caída: deja el estado en rojo y
  // avisa a los administradores (sin repetir el mismo correo en cada intento).
  // Un rechazo del propio webhook del mayorista no significa que su app esté caída:
  // la conexión solo se marca en rojo cuando de verdad no hubo respuesta.
  if (result.reachable !== true) {
    await registerConnectionResult(base44, connection, { ok: false, error: `No se pudo avisar al mayorista: ${result.error}` });
  }

  return { enviado: false, mensaje: `No se pudo avisar al mayorista: ${result.error}. Queda pendiente y se reintenta.` };
}

// Reintenta los avisos que quedaron pendientes para un mayorista concreto.
export async function retryPendingReceptions(base44: any, connection: any = null) {
  const target = connection?.id ? connection : await getPrimaryConnection(base44);
  const pendientes = await pendingOfConnection(base44, target);

  if (!pendientes.length) {
    await updateConnection(base44, target.id, { pending_notifications: 0 });
    return { enviados: 0, pendientes: 0, mensaje: 'No había avisos pendientes.' };
  }

  const photoMap = await receptionPhotosByPackageId(base44, pendientes.map((log: any) => log.package_id));

  // Un aviso que ya salió al mayorista solo se repite cuando aparece la foto de la
  // carga: mientras no exista, se espera sin volver a molestar al mayorista.
  const receptions: any[] = [];
  let esperandoFoto = 0;
  for (const log of pendientes) {
    const fotos = photoMap[log.package_id] || [];
    if (log.notified_date && log.photo_pending === true && fotos.length === 0) {
      esperandoFoto++;
      continue;
    }
    receptions.push({
      tracking: log.tracking_number || '',
      shipping_mark: log.shipping_mark || '',
      client_email: log.client_email || '',
      estado: 'recibido',
      fecha: log.event_date,
      log_id: log.id,
      fotos,
    });
  }

  // El intento (con su resultado y su historial) lo anota notifyReceptionBlock;
  // si falta la dirección de ese mayorista no se gasta intento.
  const result = receptions.length
    ? await notifyReceptionBlock(base44, receptions, target)
    : { enviado: false, mensaje: 'Los avisos pendientes están esperando la foto de la carga.' };

  const stillPending = (await pendingOfConnection(base44, target)).length;
  await updateConnection(base44, target.id, { pending_notifications: stillPending });

  return {
    enviados: result.enviado ? receptions.length : 0,
    pendientes: stillPending,
    sin_foto: esperandoFoto,
    mensaje: result.enviado
      ? `Se avisaron ${receptions.length} recepción(es) pendiente(s).`
      : `Sigue(n) ${stillPending} aviso(s) pendiente(s): ${result.mensaje}`,
  };
}

// Confirma al mayorista la recepción de una carga que ya está registrada y ahora
// tiene cliente: le manda el tracking con la foto que capturó TLEC CARGO. Si no hay
// foto todavía, el aviso queda pendiente para enviarla cuando exista; un fallo de
// conexión también queda pendiente, sin darse por enviado.
export async function confirmReceptionToWholesaler(base44: any, pkg: any, by = '') {
  const connection = await wholesalerTargetForPackage(base44, pkg);
  if (!connection?.id) {
    // Sin mayorista identificado se dice claramente en vez de devolver vacío: quien
    // asigna ve que la carga quedó recibida pero que no hubo a quién avisarle.
    const fotos = receptionPhotos(pkg);
    return {
      enviado: false,
      sin_mayorista: true,
      mayorista: '',
      fotos_count: fotos.length,
      foto_pendiente: fotos.length === 0,
      mensaje: 'No se identificó al mayorista de esta carga: no se envió aviso.',
    };
  }

  const queued = await queueReceptionNotice(base44, pkg, connection, by);
  if (!queued?.log_id) return null;

  if (queued.ya_avisado) {
    return {
      enviado: false,
      ya_avisado: true,
      mayorista: connectionLabel(connection),
      fotos_count: queued.fotos_count,
      foto_pendiente: queued.foto_pendiente,
      mensaje: `La recepción de ese tracking ya se le había avisado a ${connectionLabel(connection)}.`,
    };
  }

  const result = await notifyReceptionBlock(base44, [{
    tracking: String(pkg?.tracking_number || ''),
    shipping_mark: pkg?.shipping_mark || '',
    client_email: String(pkg?.client_email || '').trim(),
    estado: 'recibido',
    fecha: pkg?.received_date || new Date().toISOString(),
    log_id: queued.log_id,
    fotos: queued.fotos,
  }], connection);

  return {
    enviado: result.enviado === true,
    ya_avisado: false,
    mayorista: connectionLabel(connection),
    confirmacion: result.confirmation || '',
    fotos_count: queued.fotos_count,
    foto_pendiente: queued.foto_pendiente,
    mensaje: result.mensaje,
  };
}