// Aviso a la app de cada mayorista cuando su carga se recibe en el almacén de
// China. La dirección y la clave salen siempre de su conexión guardada (nunca de
// quien llama) y los envíos fallidos quedan pendientes para reintentar en el
// corte siguiente. Cada intento queda anotado en el movimiento de la recepción
// (resultado, fecha y cuántas fotos iban en ese envío), que es lo que alimenta el
// historial de envíos al mayorista del panel.
import {
  DEFAULT_CONNECTION_KEY,
  connectionKeyOf,
  connectionLabel,
  getPrimaryConnection,
  logWholesalerEvent,
  outboundKeyFor,
  truncate,
  updateConnection,
} from './wholesalerCore.ts';
import { registerConnectionResult } from './wholesalerHealth.ts';
import { photosByPackageId } from './wholesalerOutbound.ts';

const MAX_ATTEMPTS = 5;
const MAX_HISTORY = 10;
const TIMEOUT_MS = 15000;

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
    if (!res.ok) throw new Error(`la app del mayorista respondió ${res.status}`);
    return { ok: true, error: null };
  } catch (err: any) {
    const message = err?.name === 'AbortError' ? 'la app del mayorista no respondió a tiempo' : (err?.message || 'no se pudo conectar');
    return { ok: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}

function buildPayload(receptions: any[]) {
  return {
    evento: 'carga_recibida_en_china',
    fecha: new Date().toISOString(),
    total: receptions.length,
    paquetes: receptions.map((r) => ({
      tracking: r.tracking,
      shipping_mark: r.shipping_mark || '',
      estado: r.estado || 'recibido',
      fecha: r.fecha || new Date().toISOString(),
      huerfano: r.huerfano === true,
      // Direcciones públicas listas para mostrar en la app del mayorista.
      fotos: Array.isArray(r.fotos) ? r.fotos : [],
    })),
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

// Deja constancia del intento de entrega en el movimiento de cada paquete
// avisado: solo se marca entregado cuando la app del mayorista confirmó.
export async function recordNotifyAttempt(base44: any, logs: any[], { ok, detail, fotosByLogId }: any) {
  const now = new Date().toISOString();

  for (const log of logs || []) {
    if (!log?.id) continue;
    const attempts = (Number(log.notify_attempts) || 0) + (ok ? 0 : 1);
    const entry = {
      date: now,
      result: ok ? 'enviado' : 'fallido',
      detail: truncate(detail, 300),
      fotos_count: Number(fotosByLogId?.[log.id]) || 0,
    };
    const history = [...(Array.isArray(log.notify_history) ? log.notify_history : []), entry].slice(-MAX_HISTORY);

    try {
      await base44.asServiceRole.entities.WholesalerLog.update(log.id, {
        notify_pending: ok ? false : attempts < MAX_ATTEMPTS,
        notify_attempts: attempts,
        notify_history: history,
        ...(ok ? { notified_date: now } : {}),
      });
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

  const url = String(connection?.notify_url || '').trim();
  if (connection?.notify_enabled === false || !url) {
    return {
      enviado: false,
      configurado: false,
      mensaje: `El aviso automático de ${connectionLabel(connection)} está desactivado o falta su dirección: la recepción queda registrada y pendiente de avisar.`,
    };
  }

  const fotosByLogId: Record<string, number> = {};
  for (const r of receptions) {
    if (r?.log_id) fotosByLogId[r.log_id] = Array.isArray(r.fotos) ? r.fotos.length : 0;
  }

  const key = outboundKeyFor(connection);
  const result = await postToWholesaler(url, key, buildPayload(receptions));
  const now = new Date().toISOString();
  const logs = await receptionLogs(base44, receptions);

  if (result.ok) {
    await recordNotifyAttempt(base44, logs, {
      ok: true,
      detail: `${receptions.length} paquete(s) avisados a la app del mayorista`,
      fotosByLogId,
    });
    await updateConnection(base44, connection.id, {
      last_notify_date: now,
      last_notify_status: 'enviado',
      last_notify_message: `Aviso enviado: ${receptions.length} paquete(s).`,
    });
    await logWholesalerEvent(base44, {
      event_type: 'aviso_enviado',
      tracking_number: truncate(receptions.map((r) => r.tracking).join(', '), 250),
      result: 'enviado',
      detail: `${receptions.length} paquete(s) avisados a la app del mayorista`,
      wholesaler_key: connectionKeyOf(connection),
      wholesaler_name: connectionLabel(connection),
    });
    return { enviado: true, mensaje: `Aviso enviado al mayorista (${receptions.length} paquete(s)).` };
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
  });
  // Un aviso que no sale cuenta como conexión caída: deja el estado en rojo y
  // avisa a los administradores (sin repetir el mismo correo en cada intento).
  await registerConnectionResult(base44, connection, { ok: false, error: `No se pudo avisar al mayorista: ${result.error}` });

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

  const photoMap = await photosByPackageId(base44, pendientes.map((log: any) => log.package_id));

  const receptions = pendientes.map((log: any) => ({
    tracking: log.tracking_number || '',
    shipping_mark: log.shipping_mark || '',
    estado: 'recibido',
    fecha: log.event_date,
    log_id: log.id,
    fotos: photoMap[log.package_id] || [],
  }));

  // El intento (con su resultado y su historial) lo anota notifyReceptionBlock;
  // si falta la dirección de ese mayorista no se gasta intento.
  const result = await notifyReceptionBlock(base44, receptions, target);

  const stillPending = (await pendingOfConnection(base44, target)).length;
  await updateConnection(base44, target.id, { pending_notifications: stillPending });

  return {
    enviados: result.enviado ? receptions.length : 0,
    pendientes: stillPending,
    mensaje: result.enviado
      ? `Se avisaron ${receptions.length} recepción(es) pendiente(s).`
      : `Sigue(n) ${stillPending} aviso(s) pendiente(s): ${result.mensaje}`,
  };
}