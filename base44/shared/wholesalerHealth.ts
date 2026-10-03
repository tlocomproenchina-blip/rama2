// Salud de cada conexión con un mayorista: prueba liviana contra su app, estado
// guardado en la conexión y aviso a los administradores cuando deja de responder.
import {
  caracasDateKey,
  connectionKeyOf,
  connectionLabel,
  emailsEnabled,
  logWholesalerEvent,
  outboundKeyFor,
  truncate,
  updateConnection,
} from './wholesalerCore.ts';

const TIMEOUT_MS = 20000;

// Prueba liviana: le pide un solo cliente a la app del mayorista. No trae ni crea
// clientes: solo verifica que su dirección responde y acepta la clave.
export async function probeConnection(connection: any) {
  const url = String(connection?.clients_feed_url || '').trim();
  if (!url) {
    return { ok: false, missing: true, error: 'Falta la dirección para pedirle sus clientes nuevos.', clients: 0 };
  }

  const key = outboundKeyFor(connection);
  const target = `${url}${url.includes('?') ? '&' : '?'}limit=1`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(target, {
      method: 'GET',
      headers: key ? { 'x-api-key': key } : {},
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, error: `La app del mayorista respondió ${res.status}.`, clients: 0 };

    const data = await res.json().catch(() => null);
    const list = Array.isArray(data)
      ? data
      : (Array.isArray(data?.clients) ? data.clients : (Array.isArray(data?.data) ? data.data : []));
    const total = Number(data?.total);
    return { ok: true, error: null, clients: Number.isFinite(total) ? total : list.length };
  } catch (err: any) {
    const message = err?.name === 'AbortError'
      ? 'La app del mayorista no respondió a tiempo.'
      : (err?.message || 'No se pudo consultar la app del mayorista.');
    return { ok: false, error: message, clients: 0 };
  } finally {
    clearTimeout(timer);
  }
}

async function notifyAdminsConnectionFailure(base44: any, connection: any, message: string, failures: number) {
  if (!(await emailsEnabled(base44))) return { enviados: 0 };

  const name = connectionLabel(connection);
  const subject = `Conexión caída con el mayorista: ${name}`;
  const html = `
    <div style="font-family:Arial,sans-serif;color:#1e293b;">
      <h2 style="margin:0 0 4px;">El mayorista ${name} dejó de responder</h2>
      <p style="margin:0 0 10px;color:#475569;">Motivo: ${message}</p>
      <p style="margin:0 0 10px;color:#475569;">
        ${failures > 1 ? `Van ${failures} intentos seguidos sin respuesta.` : 'Es el primer intento sin respuesta.'}
        Revisa la conexión desde «Clientes Mayorista» en TLEC CARGO.
      </p>
      <p style="margin:14px 0 0;color:#64748b;font-size:12px;">TLEC CARGO · ${caracasDateKey()}</p>
    </div>`;

  let admins: any[] = [];
  try {
    admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' }, '-created_date', 100);
  } catch (_) {
    admins = [];
  }

  let enviados = 0;
  for (const admin of admins || []) {
    if (!admin?.email) continue;
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({ to: admin.email, subject, html });
      enviados += 1;
      try {
        await base44.asServiceRole.entities.EmailLog.create({
          recipient_email: admin.email,
          recipient_name: admin.full_name || null,
          subject,
          body_preview: truncate(html, 500),
          source: 'manual',
          status: 'sent',
          sent_date: new Date().toISOString(),
        });
      } catch (_) {}
    } catch (_) {}
  }

  return { enviados };
}

// Guarda el resultado de una verificación. Cuando falla, avisa a los
// administradores solo la primera vez, la segunda y cuando cambia el motivo: así
// no se repite el mismo correo en cada intento.
export async function registerConnectionResult(base44: any, connection: any, result: any) {
  const now = new Date().toISOString();

  // Sin dirección configurada no es una conexión caída: queda sin probar y sin
  // avisar a nadie.
  if (result?.missing) {
    await updateConnection(base44, connection?.id, {
      connection_status: 'sin_probar',
      connection_checked_date: now,
      connection_message: truncate(result?.error || 'Falta configurar esa conexión.', 900),
      consecutive_failures: 0,
    });
    return { status: 'sin_probar', alerted: false };
  }

  if (result?.ok) {
    const clients = Number(result?.clients) || 0;
    const recovered = connection?.connection_status === 'error';
    await updateConnection(base44, connection?.id, {
      connection_status: 'conectado',
      connection_checked_date: now,
      connection_message: truncate(result?.message || `Conectado: respondió con ${clients} cliente(s).`, 900),
      connection_clients_count: clients,
      consecutive_failures: 0,
      alerted_message: '',
    });
    if (recovered) {
      await logWholesalerEvent(base44, {
        event_type: 'conexion_ok',
        wholesaler_key: connectionKeyOf(connection),
        wholesaler_name: connectionLabel(connection),
        result: 'conectado',
        detail: 'La conexión volvió a responder',
      });
    }
    return { status: 'conectado', alerted: false };
  }

  const message = truncate(result?.error || 'No se pudo consultar la app del mayorista.', 900);
  const failures = (Number(connection?.consecutive_failures) || 0) + 1;
  const previousAlert = String(connection?.alerted_message || '').trim();
  const shouldAlert = failures <= 2 || (!!previousAlert && previousAlert !== message);

  await updateConnection(base44, connection?.id, {
    connection_status: 'error',
    connection_checked_date: now,
    connection_message: message,
    consecutive_failures: failures,
    ...(shouldAlert ? { alerted_message: message, alerted_date: now } : {}),
  });

  await logWholesalerEvent(base44, {
    event_type: 'conexion_fallida',
    wholesaler_key: connectionKeyOf(connection),
    wholesaler_name: connectionLabel(connection),
    result: 'error',
    detail: message,
  });

  let aviso = { enviados: 0 };
  if (shouldAlert) aviso = await notifyAdminsConnectionFailure(base44, connection, message, failures);

  return { status: 'error', alerted: shouldAlert, aviso };
}