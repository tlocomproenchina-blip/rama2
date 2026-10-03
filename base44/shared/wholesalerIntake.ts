// Trae los clientes nuevos que reporta cada app mayorista y los deja listos en
// TLEC CARGO: los que ya existen se detectan (por correo o cédula) y los nuevos
// quedan pendientes de crear su cuenta, que se crea desde el panel con un clic
// (la plataforma solo permite invitar usuarios desde una sesión de admin).
import { logWholesalerEvent, outboundKeyFor, stampOf, stampMatches, truncate } from './wholesalerCore.ts';

const TIMEOUT_MS = 20000;
const MAX_CLIENTS_PER_RUN = 100;

function pickValue(raw: any, keys: string[]) {
  for (const key of keys) {
    const value = raw?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
  }
  return '';
}

export function normalizeClient(raw: any) {
  const first = pickValue(raw, ['first_name', 'nombres']);
  const last = pickValue(raw, ['last_name', 'apellidos']);
  const fullName = pickValue(raw, ['full_name', 'name', 'nombre_completo', 'nombre']) || `${first} ${last}`.trim();
  return {
    external_id: pickValue(raw, ['external_id', 'id', 'client_id']),
    first_name: first,
    last_name: last,
    full_name: fullName,
    email: pickValue(raw, ['email', 'correo']).toLowerCase(),
    cedula: pickValue(raw, ['cedula', 'cedula_rif', 'documento']),
    whatsapp: pickValue(raw, ['whatsapp', 'phone', 'telefono']),
    city: pickValue(raw, ['city', 'ciudad']),
    state: pickValue(raw, ['state', 'estado']),
    address: pickValue(raw, ['address', 'direccion']),
    shipping_mark: pickValue(raw, ['shipping_mark', 'marca']),
  };
}

async function fetchClients(url: string, key: string, since: string) {
  const target = since ? `${url}${url.includes('?') ? '&' : '?'}since=${encodeURIComponent(since)}` : url;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(target, {
      method: 'GET',
      headers: key ? { 'x-api-key': key } : {},
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, clients: [], error: `La app del mayorista respondió ${res.status}.` };
    const data = await res.json().catch(() => null);
    const list = Array.isArray(data)
      ? data
      : (Array.isArray(data?.clients) ? data.clients : (Array.isArray(data?.data) ? data.data : []));
    return { ok: true, clients: list, error: null };
  } catch (err: any) {
    const message = err?.name === 'AbortError' ? 'La app del mayorista no respondió a tiempo.' : (err?.message || 'No se pudo consultar la app del mayorista.');
    return { ok: false, clients: [], error: message };
  } finally {
    clearTimeout(timer);
  }
}

// Pide los clientes nuevos a la app de ese mayorista (una conexión concreta).
export async function fetchWholesalerClients(base44: any, cfg: any) {
  const url = String(cfg?.clients_feed_url || '').trim();
  if (!url) return { ok: false, clients: [], error: 'Falta la dirección de la app del mayorista.' };
  return fetchClients(url, outboundKeyFor(cfg), String(cfg?.last_cursor || ''));
}

async function lookupUser(base44: any, query: Record<string, any>) {
  try {
    const rows = await base44.asServiceRole.entities.User.filter(query, '-created_date', 1);
    return rows?.[0] || null;
  } catch (_) {
    return null;
  }
}

async function buildRecord(base44: any, client: any, connection: any, extra: Record<string, any>) {
  try {
    return await base44.asServiceRole.entities.WholesalerClient.create({
      ...client,
      source_app: 'mayorista',
      fetched_date: new Date().toISOString(),
      report_sent: false,
      account_created: false,
      already_existed: false,
      status: 'pendiente',
      ...stampOf(connection),
      ...extra,
    });
  } catch (_) {
    return null;
  }
}

function eventStamp(connection: any) {
  return stampOf(connection);
}

export async function intakeClients(base44: any, rawClients: any[], connection: any = null) {
  const clients = (rawClients || []).slice(0, MAX_CLIENTS_PER_RUN);
  const results: any[] = [];

  for (const raw of clients) {
    const client = normalizeClient(raw);

    if (!client.email) {
      const record = await buildRecord(base44, client, connection, {
        status: 'error',
        message: 'El cliente llegó sin correo: no se puede dar de alta.',
      });
      await logWholesalerEvent(base44, {
        event_type: 'cliente_error',
        client_email: '',
        result: 'sin_correo',
        detail: 'El cliente llegó sin correo',
        ...eventStamp(connection),
      });
      if (record) results.push(record);
      continue;
    }

    // ¿Ese mismo mayorista ya lo había reportado antes? No se repite ni se
    // cuenta dos veces (si dos mayoristas reportan al mismo cliente, cada uno
    // deja su propio registro).
    let alreadyReported = false;
    try {
      const previous = await base44.asServiceRole.entities.WholesalerClient.filter({ email: client.email }, '-fetched_date', 5);
      alreadyReported = (previous || []).some((row: any) => row.status !== 'error' && stampMatches(row, connection));
    } catch (_) {}
    if (alreadyReported) continue;

    // ¿Ya existe como cliente en TLEC CARGO?
    let existing = await lookupUser(base44, { email: client.email });
    if (!existing && client.cedula) existing = await lookupUser(base44, { cedula: client.cedula });

    if (existing) {
      const record = await buildRecord(base44, client, connection, {
        user_id: existing.id,
        status: 'existente',
        already_existed: true,
        shipping_mark: existing.shipping_mark || client.shipping_mark,
        message: 'Ya existía en TLEC CARGO: no se duplicó.',
      });
      await logWholesalerEvent(base44, {
        event_type: 'cliente_existente',
        client_email: client.email,
        result: 'existente',
        detail: 'El cliente ya existía en TLEC CARGO',
        ...eventStamp(connection),
      });
      if (record) results.push(record);
      continue;
    }

    const record = await buildRecord(base44, client, connection, {
      status: 'pendiente',
      message: 'Cliente nuevo: falta crear su cuenta en TLEC CARGO desde el panel.',
    });
    await logWholesalerEvent(base44, {
      event_type: 'cliente_pendiente',
      client_email: client.email,
      result: 'pendiente',
      detail: 'Cliente nuevo traído del mayorista: pendiente de crear su cuenta',
      ...eventStamp(connection),
    });
    if (record) results.push(record);
  }

  return results;
}

// Cierra el alta de un cliente: se llama desde el panel cuando la cuenta ya se
// creó allí (invitación + datos + Shipping Mark).
export async function completeClient(base44: any, clientId: string, shippingMark: string, note: string) {
  const rows = await base44.asServiceRole.entities.WholesalerClient.filter({ id: clientId }, '-fetched_date', 1);
  const record = rows?.[0] || null;
  if (!record) return { ok: false, error: 'No se encontró el cliente en el informe del mayorista.' };
  if (record.status === 'creado') {
    return { ok: true, already: true, client: record };
  }

  const user = await lookupUser(base44, { email: record.email });
  const mark = shippingMark || record.shipping_mark || user?.shipping_mark || '';

  const updated = await base44.asServiceRole.entities.WholesalerClient.update(clientId, {
    status: 'creado',
    account_created: true,
    shipping_mark: mark,
    user_id: user?.id || record.user_id || '',
    message: truncate(note || 'Cuenta creada en TLEC CARGO.', 900),
  });

  await logWholesalerEvent(base44, {
    event_type: 'cliente_nuevo',
    client_email: record.email,
    shipping_mark: mark,
    result: 'creado',
    detail: 'Cliente nuevo del mayorista creado en TLEC CARGO',
    wholesaler_key: record.wholesaler_key || '',
    wholesaler_name: record.wholesaler_name || '',
  });

  return { ok: true, already: false, client: updated };
}