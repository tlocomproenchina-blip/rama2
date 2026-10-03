// Aviso a la app de cada mayorista cuando su carga se recibe en el almacén de
// China. La dirección y la clave salen siempre de su conexión guardada (nunca de
// quien llama) y los envíos fallidos quedan pendientes para reintentar en el
// corte siguiente.
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

const MAX_ATTEMPTS = 5;
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
    })),
  };
}

async function markNotified(base44: any, logIds: string[]) {
  const now = new Date().toISOString();
  for (const id of logIds) {
    try {
      await base44.asServiceRole.entities.WholesalerLog.update(id, { notify_pending: false, notified_date: now });
    } catch (_) {}
  }
}

async function markFailed(base44: any, logs: any[]) {
  for (const log of logs) {
    const attempts = (Number(log.notify_attempts) || 0) + 1;
    try {
      await base44.asServiceRole.entities.WholesalerLog.update(log.id, {
        notify_attempts: attempts,
        notify_pending: attempts < MAX_ATTEMPTS,
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

  const key = outboundKeyFor(connection);
  const result = await postToWholesaler(url, key, buildPayload(receptions));
  const now = new Date().toISOString();
  const logIds = receptions.map((r) => r.log_id).filter(Boolean);

  if (result.ok) {
    await markNotified(base44, logIds);
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

  const receptions = pendientes.map((log: any) => ({
    tracking: log.tracking_number || '',
    shipping_mark: log.shipping_mark || '',
    estado: 'recibido',
    fecha: log.event_date,
    log_id: log.id,
  }));

  const result = await notifyReceptionBlock(base44, receptions, target);
  // Solo cuentan como intento fallido cuando hubo a dónde llamar; si falta la
  // dirección, las recepciones quedan pendientes sin gastar intentos.
  if (!result.enviado && (result as any).configurado !== false) await markFailed(base44, pendientes);

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