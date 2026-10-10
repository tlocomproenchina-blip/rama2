// Núcleo compartido de la integración con las apps de los clientes mayoristas:
// las conexiones (una por mayorista), el historial de movimientos y las fechas
// en hora de Caracas.

export const WHOLESALER_SOURCE = 'mayorista';
export const DEFAULT_CONNECTION_KEY = 'main';

function envKey(name: string) {
  return String(Deno.env.get(name) || '').trim();
}

// Claves de Secretos: quedan como respaldo de la conexión que ya estaba
// emparejada, así agregar conexiones nuevas no rompe la existente.
export function envInboundKey() {
  return envKey('WHOLESALER_API_KEY') || envKey('WHOLESALER_WEBHOOK_KEY');
}

export function envOutboundKey() {
  return envKey('WHOLESALER_WEBHOOK_KEY') || envKey('WHOLESALER_API_KEY');
}

export function connectionKeyOf(connection: any) {
  return String(connection?.config_key || '').trim() || DEFAULT_CONNECTION_KEY;
}

export function connectionLabel(connection: any) {
  return String(connection?.wholesaler_name || '').trim() || 'Cliente mayorista';
}

// Clave con la que ese mayorista llama a esta app.
export function inboundKeyFor(connection: any) {
  return String(connection?.inbound_key || '').trim() || envInboundKey();
}

// Clave con la que esta app llama a ese mayorista.
export function outboundKeyFor(connection: any) {
  return String(connection?.outbound_key || '').trim() || envOutboundKey();
}

// Marca de origen que se guarda en cada cliente y movimiento.
export function stampOf(connection?: any) {
  if (!connection) return {};
  return {
    wholesaler_key: connectionKeyOf(connection),
    wholesaler_name: connectionLabel(connection),
  };
}

export function stampMatches(row: any, connection: any) {
  const rowKey = String(row?.wholesaler_key || '').trim() || DEFAULT_CONNECTION_KEY;
  return rowKey === connectionKeyOf(connection);
}

// Todas las conexiones, de la más antigua a la más nueva (la primera es la de
// siempre: la que se emparejó antes de admitir varios mayoristas).
export async function listWholesalerConnections(base44: any) {
  try {
    const rows = await base44.asServiceRole.entities.WholesalerSync.list('created_date', 100);
    if (Array.isArray(rows)) return rows;
  } catch (_) {}
  return [];
}

export async function getPrimaryConnection(base44: any) {
  const rows = await listWholesalerConnections(base44);
  if (rows.length) return rows[0];

  // Primera vez: dejar la conexión creada con los valores por defecto.
  try {
    return await base44.asServiceRole.entities.WholesalerSync.create({
      config_key: DEFAULT_CONNECTION_KEY,
      wholesaler_name: 'Cliente mayorista',
      intake_enabled: true,
      report_email_enabled: true,
      notify_enabled: true,
      connection_status: 'sin_probar',
      last_run_status: 'nunca',
      last_report_status: 'nunca',
    });
  } catch (_) {
    return { config_key: DEFAULT_CONNECTION_KEY, wholesaler_name: 'Cliente mayorista' };
  }
}

export async function updateConnection(base44: any, connectionId: string, patch: Record<string, any>) {
  if (!connectionId) return null;
  try {
    return await base44.asServiceRole.entities.WholesalerSync.update(connectionId, patch);
  } catch (_) {
    return null;
  }
}

export async function findConnectionById(base44: any, idOrKey: string) {
  const value = String(idOrKey || '').trim();
  if (!value) return null;
  const rows = await listWholesalerConnections(base44);
  return rows.find((row: any) => row.id === value || row.config_key === value) || null;
}

// Resuelve cuál de los mayoristas está llamando, por la clave que presenta.
export async function resolveConnectionForKey(base44: any, provided: string) {
  const value = String(provided || '').trim();
  if (!value) return null;

  const rows = await listWholesalerConnections(base44);
  const match = rows.find((row: any) =>
    String(row.inbound_key || '').trim() === value || String(row.outbound_key || '').trim() === value
  );
  if (match) return match;

  // Claves de Secretos: solo emparejan con la conexión principal.
  const envKeys = [envKey('WHOLESALER_API_KEY'), envKey('WHOLESALER_WEBHOOK_KEY')].filter(Boolean);
  if (envKeys.includes(value)) return rows[0] || (await getPrimaryConnection(base44));

  return null;
}

export async function logWholesalerEvent(base44: any, entry: Record<string, any>) {
  try {
    return await base44.asServiceRole.entities.WholesalerLog.create({
      event_date: new Date().toISOString(),
      source_app: WHOLESALER_SOURCE,
      ...entry,
    });
  } catch (_) {
    return null;
  }
}

export function caracasDateKey(date: Date = new Date()) {
  // en-CA devuelve YYYY-MM-DD
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });
}

export function formatCaracasDateTime(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-VE', {
      timeZone: 'America/Caracas',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (_) {
    return '—';
  }
}

export async function emailsEnabled(base44: any) {
  try {
    const cfgs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1);
    return cfgs?.[0]?.emails_enabled !== false;
  } catch (_) {
    return true;
  }
}

export function truncate(value: any, max = 900) {
  return String(value ?? '').slice(0, max);
}

// Las funciones de una app viven en /functions/<nombre>. Si la dirección guardada
// apunta a la raíz de la app (sin /functions/), se completa sola: así un aviso no
// cae en la página web del mayorista y se pierde en silencio.
export function appFunctionUrl(raw: any) {
  const url = String(raw || '').trim();
  if (!url || !/^https?:\/\//i.test(url)) return url;
  if (url.includes('/functions/')) return url.replace(/\/+$/, '');
  const match = url.match(/^(https?:\/\/[^/]+)\/([A-Za-z0-9_-]+)\/?$/);
  return match ? `${match[1]}/functions/${match[2]}` : url;
}