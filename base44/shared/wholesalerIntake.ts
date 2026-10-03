// Trae los clientes nuevos que reporta la app del mayorista y los da de alta aquí
// como clientes reales, con su Shipping Mark según la configuración vigente.
import { logWholesalerEvent, truncate } from './wholesalerCore.ts';
import { assignShippingMarkToUser, shippingMarkAutoAssignEnabled } from './shippingMark.ts';

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

export async function fetchWholesalerClients(base44: any, cfg: any) {
  const url = String(cfg?.clients_feed_url || '').trim();
  if (!url) return { ok: false, clients: [], error: 'Falta la dirección de la app del mayorista.' };

  const key = Deno.env.get('WHOLESALER_WEBHOOK_KEY');
  const since = cfg?.last_cursor || '';
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

async function lookupUser(base44: any, query: Record<string, any>) {
  try {
    const rows = await base44.asServiceRole.entities.User.filter(query, '-created_date', 1);
    return rows?.[0] || null;
  } catch (_) {
    return null;
  }
}

async function findUserByEmail(base44: any, email: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const found = await lookupUser(base44, { email });
    if (found) return found;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return null;
}

// Respaldo: la invitación de la plataforma (única vía cuando el cliente llega
// sin nombre completo o sin cédula, que son obligatorios para crear la cuenta).
async function inviteClient(base44: any, email: string) {
  const candidates: Array<() => Promise<any>> = [];
  if (base44.users?.inviteUser) candidates.push(() => base44.users.inviteUser(email, 'user'));
  if (base44.auth?.inviteUser) candidates.push(() => base44.auth.inviteUser(email, 'user'));

  let lastError = 'No hay un método disponible para invitar clientes.';
  for (const invite of candidates) {
    try {
      await invite();
      return { ok: true, error: null };
    } catch (err: any) {
      lastError = err?.message || String(err);
    }
  }
  return { ok: false, error: truncate(lastError, 300) };
}

function fullNameOf(client: any) {
  return client.full_name || `${client.first_name} ${client.last_name}`.trim() || client.email;
}

async function createClientUser(base44: any, client: any) {
  try {
    const created = await base44.asServiceRole.entities.User.create({
      email: client.email,
      role: 'user',
      full_name: fullNameOf(client),
      cedula: client.cedula || '',
      first_name: client.first_name || '',
      last_name: client.last_name || '',
      whatsapp: client.whatsapp || '',
      city: client.city || '',
      state: client.state || '',
      address: client.address || '',
      profile_completed: true,
    });
    return { ok: true, user: created, method: 'alta_directa' };
  } catch (err: any) {
    const createError = truncate(err?.message || 'No se pudo crear la cuenta.', 300);
    const invited = await inviteClient(base44, client.email);
    if (invited.ok) {
      const found = await findUserByEmail(base44, client.email);
      if (found) return { ok: true, user: found, method: 'invitacion' };
    }
    return { ok: false, error: createError };
  }
}

async function buildRecord(base44: any, client: any, extra: Record<string, any>) {
  try {
    return await base44.asServiceRole.entities.WholesalerClient.create({
      ...client,
      source_app: 'mayorista',
      fetched_date: new Date().toISOString(),
      report_sent: false,
      account_created: false,
      already_existed: false,
      status: 'creado',
      ...extra,
    });
  } catch (_) {
    return null;
  }
}

export async function intakeClients(base44: any, rawClients: any[]) {
  const clients = (rawClients || []).slice(0, MAX_CLIENTS_PER_RUN);
  const autoAssign = await shippingMarkAutoAssignEnabled(base44);
  const results: any[] = [];

  for (const raw of clients) {
    const client = normalizeClient(raw);

    if (!client.email) {
      const record = await buildRecord(base44, client, {
        status: 'error',
        message: 'El cliente llegó sin correo: no se puede dar de alta.',
      });
      await logWholesalerEvent(base44, { event_type: 'cliente_error', client_email: '', result: 'sin_correo', detail: 'El cliente llegó sin correo' });
      if (record) results.push(record);
      continue;
    }

    // ¿Ya salió en un corte anterior? No se repite ni se cuenta dos veces.
    let alreadyReported = false;
    try {
      const previous = await base44.asServiceRole.entities.WholesalerClient.filter({ email: client.email }, '-fetched_date', 5);
      alreadyReported = (previous || []).some((row: any) => row.status !== 'error');
    } catch (_) {}
    if (alreadyReported) continue;

    // ¿Ya existe como cliente en TLEC CARGO?
    let existing = await lookupUser(base44, { email: client.email });
    if (!existing && client.cedula) existing = await lookupUser(base44, { cedula: client.cedula });

    if (existing) {
      const record = await buildRecord(base44, client, {
        user_id: existing.id,
        status: 'existente',
        already_existed: true,
        shipping_mark: existing.shipping_mark || client.shipping_mark,
        message: 'Ya existía en TLEC CARGO: no se duplicó.',
      });
      await logWholesalerEvent(base44, { event_type: 'cliente_existente', client_email: client.email, result: 'existente', detail: 'El cliente ya existía en TLEC CARGO' });
      if (record) results.push(record);
      continue;
    }

    // Alta de la cuenta
    const createdResult = await createClientUser(base44, client);
    if (!createdResult.ok) {
      const record = await buildRecord(base44, client, {
        status: 'error',
        message: `No se pudo crear la cuenta: ${createdResult.error}`,
      });
      await logWholesalerEvent(base44, { event_type: 'cliente_error', client_email: client.email, result: 'alta_fallida', detail: createdResult.error });
      if (record) results.push(record);
      continue;
    }

    const created = createdResult.user;

    // Shipping Mark: se genera aquí si la app lo tiene automatizado; si no, se
    // conserva el que reporta el mayorista.
    let shippingMark = client.shipping_mark || '';
    let markSaved = false;
    let message = '';

    if (autoAssign) {
      const assigned = await assignShippingMarkToUser(base44, {
        id: created.id,
        email: created.email || client.email,
        state: client.state || created.state || '',
      });
      if (assigned?.ok) {
        shippingMark = assigned.shipping_mark;
        markSaved = true;
      } else {
        message = assigned?.error || '';
      }
    }

    if (shippingMark && !markSaved) {
      try {
        await base44.asServiceRole.entities.User.update(created.id, { shipping_mark: shippingMark });
      } catch (err: any) {
        message = truncate([message, err?.message].filter(Boolean).join(' · '), 400);
      }
    }

    const record = await buildRecord(base44, client, {
      user_id: created.id,
      status: 'creado',
      account_created: true,
      shipping_mark: shippingMark,
      message: message || `Cuenta creada (${createdResult.method}).`,
    });
    await logWholesalerEvent(base44, {
      event_type: 'cliente_nuevo',
      client_email: client.email,
      shipping_mark: shippingMark,
      result: 'creado',
      detail: `Cliente nuevo creado desde la app del mayorista (${createdResult.method})`,
    });
    if (record) results.push(record);
  }

  return results;
}