// Lo que esta app le envía a la app de cada mayorista: cada carga recibida en el
// almacén de China se le avisa con su tracking y sus fotos. Ese aviso queda
// registrado en el movimiento de la recepción (WholesalerLog), que es el registro
// por paquete: su resultado, su fecha de envío, sus intentos y el historial de
// cada intento.
import { connectionKeyOf, stampMatches } from './wholesalerCore.ts';
import { findPackageByTracking, packagePhotos, receptionPhotos } from './wholesalerPackages.ts';

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

// Fotos de la recepción en el almacén (las que capturó TLEC CARGO): son las que
// viajan como confirmación visual al mayorista.
export async function receptionPhotosByPackageId(base44: any, ids: string[]) {
  const unique = Array.from(new Set((ids || []).filter(Boolean)));
  const map: Record<string, string[]> = {};
  if (!unique.length) return map;

  const rows = await base44.asServiceRole.entities.Package
    .filter({ id: { $in: unique } }, '-created_date', 500)
    .catch(() => []);

  for (const pkg of rows || []) map[pkg.id] = receptionPhotos(pkg);
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
    photo_pending: log?.photo_pending === true,
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
    can_resend: (estado !== 'enviado' || log?.photo_pending === true) && !!log?.id,
  };
}

function statusMessage(estado: string, attempts: number, photoPending = false) {
  if (estado === 'enviado') {
    return photoPending
      ? 'El aviso salió al mayorista con el tracking; falta la foto de la carga: se enviará cuando esté disponible.'
      : 'El aviso salió al mayorista con el tracking y las fotos de la carga.';
  }
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
    mensaje: statusMessage(estado, Number(log?.notify_attempts) || 0, log?.photo_pending === true),
  };
}

// ===== Resumen por cliente del mayorista =====
// Qué carga tiene cada cliente traído del mayorista y, tracking por tracking, si
// el aviso de esa carga ya salió a su app (enviado), si quedó pendiente o fallido,
// o si todavía no se le ha avisado nada (sin aviso). Es la vista con la que el
// administrador ve de un vistazo qué información le falta por llegar al cliente.
const MAX_SUMMARY_LOGS = 500;
const MAX_SUMMARY_PACKAGES = 300;
const MAX_SUMMARY_CLIENTS = 200;
const NOT_NOTIFIED_STATES = ['sin_aviso', 'fallido', 'pendiente'];

function laterDate(current: any, candidate: any) {
  if (!candidate) return current || null;
  if (!current) return candidate;
  return String(candidate) > String(current) ? candidate : current;
}

function groupKeyFor(email: any, mark: any) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (cleanEmail) return `email:${cleanEmail}`;
  const cleanMark = String(mark || '').trim().toUpperCase();
  if (cleanMark) return `mark:${cleanMark}`;
  return 'sin_cliente';
}

export async function clientSummaryOfConnection(base44: any, connections: any[], connection: any, from?: string | null) {
  const scope = connectionFilter(connections, connection);

  const clientRows = await base44.asServiceRole.entities.WholesalerClient
    .filter(scope, '-fetched_date', MAX_SUMMARY_CLIENTS)
    .catch(() => []);

  const clientsByEmail: Record<string, any> = {};
  const emails: string[] = [];
  for (const row of clientRows || []) {
    const email = String(row?.email || '').trim().toLowerCase();
    if (!email) continue;
    clientsByEmail[email] = row;
    emails.push(email);
  }

  const [logs, packages] = await Promise.all([
    base44.asServiceRole.entities.WholesalerLog
      .filter({
        event_type: 'recepcion',
        ...scope,
        ...(from ? { event_date: { $gte: from } } : {}),
      }, '-event_date', MAX_SUMMARY_LOGS)
      .catch(() => []),
    emails.length
      ? base44.asServiceRole.entities.Package
        .filter({
          client_email: { $in: emails },
          status: { $nin: ['pre_alerta', 'rechazado'] },
          ...(from ? { received_date: { $gte: from } } : {}),
        }, '-received_date', MAX_SUMMARY_PACKAGES)
        .catch(() => [])
      : Promise.resolve([] as any[]),
  ]);

  const groups: Record<string, any> = {};

  const groupFor = (email: any, mark: any) => {
    const key = groupKeyFor(email, mark);
    if (!groups[key]) {
      const client = clientsByEmail[String(email || '').trim().toLowerCase()] || null;
      groups[key] = {
        client_key: key,
        client_email: String(email || '').trim() || client?.email || '',
        client_name: client?.full_name || '',
        shipping_mark: String(mark || '').trim() || client?.shipping_mark || '',
        wholesaler_name: client?.wholesaler_name || '',
        enviados: 0,
        pendientes: 0,
        fallidos: 0,
        sin_aviso: 0,
        total: 0,
        last_activity: null,
        trackings: [],
        byTracking: {},
      };
    }
    return groups[key];
  };

  const trackingFor = (group: any, tracking: any) => {
    const clean = String(tracking || '').trim();
    const key = clean.toUpperCase() || 'sin_tracking';
    if (!group.byTracking[key]) {
      group.byTracking[key] = {
        tracking_number: clean,
        estado: 'sin_aviso',
        attempts: 0,
        notified_date: null,
        last_date: null,
        fotos_count: 0,
        log_id: null,
        can_resend: false,
      };
      group.trackings.push(group.byTracking[key]);
    }
    return group.byTracking[key];
  };

  // La carga registrada a nombre del cliente (lo que entró a nuestro almacén).
  for (const pkg of packages || []) {
    const group = groupFor(pkg?.client_email, pkg?.shipping_mark);
    const entry = trackingFor(group, pkg?.tracking_number);
    entry.fotos_count = Math.max(entry.fotos_count, packagePhotos(pkg).length);
    entry.last_date = laterDate(entry.last_date, pkg?.received_date || pkg?.created_date);
  }

  // El aviso enviado a la app del mayorista, si existe.
  for (const log of logs || []) {
    const group = groupFor(log?.client_email, log?.shipping_mark);
    const entry = trackingFor(group, log?.tracking_number);
    entry.log_id = log?.id || null;
    entry.estado = shipmentStatusOf(log);
    entry.attempts = Number(log?.notify_attempts) || 0;
    entry.notified_date = log?.notified_date || null;
    entry.can_resend = entry.estado !== 'enviado';
    entry.last_date = laterDate(entry.last_date, log?.notified_date || log?.event_date);
    if (!group.wholesaler_name && log?.wholesaler_name) group.wholesaler_name = log.wholesaler_name;
    if (!group.shipping_mark && log?.shipping_mark) group.shipping_mark = String(log.shipping_mark).trim();
  }

  return Object.values(groups)
    .map((group: any) => {
      const trackings = group.trackings as any[];
      const counts: Record<string, number> = { enviados: 0, pendientes: 0, fallidos: 0, sin_aviso: 0 };
      for (const entry of trackings) counts[entry.estado] = (counts[entry.estado] || 0) + 1;

      trackings.sort((a, b) => {
        const pendingA = NOT_NOTIFIED_STATES.includes(a.estado) ? 0 : 1;
        const pendingB = NOT_NOTIFIED_STATES.includes(b.estado) ? 0 : 1;
        if (pendingA !== pendingB) return pendingA - pendingB;
        return String(b.last_date || '').localeCompare(String(a.last_date || ''));
      });

      const last_activity = trackings.reduce((acc: any, entry: any) => laterDate(acc, entry.last_date), null);
      const pending_count = counts.pendientes + counts.fallidos + counts.sin_aviso;
      const { byTracking, ...rest } = group;
      return { ...rest, ...counts, total: trackings.length, last_activity, pending_count };
    })
    .sort((a: any, b: any) => (b.pending_count - a.pending_count)
      || String(b.last_activity || '').localeCompare(String(a.last_activity || '')))
    .map(({ pending_count, ...rest }: any) => rest);
}