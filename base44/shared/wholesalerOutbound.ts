// Lo que esta app le envía a la app de cada mayorista: cada carga recibida en el
// almacén de China se le avisa con su tracking y sus fotos. Ese aviso queda
// registrado en el movimiento de la recepción (WholesalerLog), que es el registro
// por paquete: su resultado, su fecha de envío, sus intentos y el historial de
// cada intento.
import { connectionKeyOf, stampMatches } from './wholesalerCore.ts';
import { findPackageByTracking, packagePhotos } from './wholesalerPackages.ts';

const DEFAULT_LIMIT = 50;
const MAX_STATUS_LOGS = 20;

// Mismo criterio que el panel: la conexión principal (la de siempre) también
// abarca los movimientos anteriores a admitir varios mayoristas, que quedaron sin
// marca de origen.
export function connectionFilter(connections: any[], connection: any) {
  if (!connection) return {};
  const key = connectionKeyOf(connection);
  const others = (connections || [])
    .filter((c: any) => c.id !== connection.id)
    .map((c: any) => c.config_key)
    .filter((k: string) => k && k !== key);
  if (!others.length) return {};
  if (connections?.[0]?.id === connection.id) return { wholesaler_key: { $nin: others } };
  return { wholesaler_key: key };
}

// Un aviso entregado manda; si no salió, o ya hubo intentos (fallido) o todavía
// no se ha intentado (pendiente).
export function shipmentStatusOf(log: any) {
  if (log?.notified_date) return 'enviado';
  if (Number(log?.notify_attempts) || 0) return 'fallido';
  return 'pendiente';
}

export function avisoReady(connection: any) {
  return !!connection
    && !!String(connection?.notify_url || '').trim()
    && connection?.notify_enabled !== false;
}

// Fotos públicas de cada paquete, que son las que viajan en el aviso.
export async function photosByPackageId(base44: any, ids: string[]) {
  const unique = Array.from(new Set((ids || []).filter(Boolean)));
  const map: Record<string, string[]> = {};
  if (!unique.length) return map;

  const rows = await base44.asServiceRole.entities.Package
    .filter({ id: { $in: unique } }, '-created_date', 500)
    .catch(() => []);

  for (const pkg of rows || []) map[pkg.id] = packagePhotos(pkg);
  return map;
}

export function describeShipment(log: any, fotos: string[] = []) {
  const history: any[] = Array.isArray(log?.notify_history) ? log.notify_history : [];
  const estado = shipmentStatusOf(log);

  return {
    id: log?.id || null,
    tracking_number: log?.tracking_number || '',
    client_email: log?.client_email || '',
    shipping_mark: log?.shipping_mark || '',
    wholesaler_name: log?.wholesaler_name || 'Cliente mayorista',
    package_id: log?.package_id || null,
    estado,
    attempts: Number(log?.notify_attempts) || 0,
    notified_date: log?.notified_date || null,
    event_date: log?.event_date || null,
    // Del intento más reciente al más antiguo.
    history: history.slice().reverse().map((h: any) => ({
      date: h?.date || null,
      result: h?.result || '',
      detail: h?.detail || '',
      fotos_count: Number(h?.fotos_count) || 0,
    })),
    fotos,
    fotos_count: fotos.length,
    can_resend: estado !== 'enviado' && !!log?.id,
  };
}

function statusMessage(estado: string, attempts: number) {
  if (estado === 'enviado') return 'El aviso salió al mayorista con el tracking y las fotos de la carga.';
  if (estado === 'fallido') return `El aviso no salió en ${attempts} intento(s): puedes reintentarlo desde aquí.`;
  return 'El aviso todavía no se le ha enviado al mayorista: puedes enviarlo desde aquí.';
}

// Envíos al mayorista de una conexión (o de todas) en un período.
export async function shipmentsOfConnection(base44: any, connections: any[], connection: any, from?: string | null, limit = DEFAULT_LIMIT) {
  const rows = await base44.asServiceRole.entities.WholesalerLog
    .filter({
      event_type: 'recepcion',
      ...connectionFilter(connections, connection),
      ...(from ? { event_date: { $gte: from } } : {}),
    }, '-event_date', limit)
    .catch(() => []);

  const list = rows || [];
  const photoMap = await photosByPackageId(base44, list.map((row: any) => row.package_id));
  return list.map((log: any) => describeShipment(log, photoMap[log.package_id] || []));
}

export async function countShipments(base44: any, connections: any[], connection: any, from?: string | null) {
  const base = {
    event_type: 'recepcion',
    ...connectionFilter(connections, connection),
    ...(from ? { event_date: { $gte: from } } : {}),
  };

  const [total, enviados, fallidos] = await Promise.all([
    base44.asServiceRole.entities.WholesalerLog.count(base).catch(() => 0),
    base44.asServiceRole.entities.WholesalerLog.count({ ...base, notified_date: { $exists: true } }).catch(() => 0),
    base44.asServiceRole.entities.WholesalerLog.count({ ...base, notified_date: { $exists: false }, notify_attempts: { $gt: 0 } }).catch(() => 0),
  ]);

  return {
    total,
    enviados,
    fallidos,
    pendientes: Math.max(0, (Number(total) || 0) - (Number(enviados) || 0) - (Number(fallidos) || 0)),
  };
}

// Estado por paquete: si su aviso salió al mayorista, con qué fotos y en qué
// intento. Cuando no hay ningún aviso registrado se dice tal cual: a esa carga
// todavía no se le comunicó nada al mayorista.
export async function shipmentStatusFor(base44: any, connection: any, search: any) {
  const term = String(search || '').trim();
  if (!term) return { ok: false, mensaje: 'Escribe un tracking para consultar.' };

  const pkg = await findPackageByTracking(base44, term);
  const logs = pkg
    ? await base44.asServiceRole.entities.WholesalerLog.filter({ event_type: 'recepcion', package_id: pkg.id }, '-event_date', MAX_STATUS_LOGS).catch(() => [])
    : await base44.asServiceRole.entities.WholesalerLog.filter({ event_type: 'recepcion', tracking_number: term }, '-event_date', MAX_STATUS_LOGS).catch(() => []);

  const scoped = (logs || []).filter((log: any) => !connection || stampMatches(log, connection));
  const log = scoped[0] || null;
  const fotos = packagePhotos(pkg);

  if (!pkg && !log) {
    return {
      ok: true,
      encontrado: false,
      estado: 'no_registrado',
      tracking_number: term,
      client_email: '',
      shipping_mark: '',
      fotos: [],
      fotos_count: 0,
      attempts: 0,
      history: [],
      can_resend: false,
      mensaje: 'Ese tracking no está registrado en TLEC CARGO.',
    };
  }

  if (!log) {
    return {
      ok: true,
      encontrado: true,
      estado: 'sin_aviso',
      tracking_number: pkg.tracking_number || term,
      client_email: pkg.client_email || '',
      shipping_mark: pkg.shipping_mark || '',
      package_id: pkg.id,
      package_status: pkg.status || '',
      package_orphan: pkg.is_orphan === true,
      attempts: 0,
      notified_date: null,
      event_date: pkg.received_date || pkg.created_date || null,
      history: [],
      fotos,
      fotos_count: fotos.length,
      can_resend: false,
      mensaje: 'No hay ningún aviso enviado al mayorista para esta carga: todavía no se le comunicó su tracking ni sus fotos.',
    };
  }

  const estado = shipmentStatusOf(log);
  return {
    ok: true,
    encontrado: true,
    ...describeShipment(log, fotos),
    package_status: pkg?.status || '',
    package_orphan: pkg?.is_orphan === true,
    mensaje: statusMessage(estado, Number(log?.notify_attempts) || 0),
  };
}