import { normalizeCompanyCode, PLATFORM_COMPANY_CODE, platformServiceKey } from "./companyContext.ts";

// Contexto de actor: permite que las funciones de backend trabajen igual para un
// administrador de TLEC (sesión real) o para un empleado de una empresa socia que
// llega por el canal de datos con un actor firmado por la llave de su empresa.

const ACTOR_MAX_AGE_MS = 10 * 60 * 1000;

export async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(String(secret)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(String(message)));
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function actorSignatureMessage(actor) {
  return [
    String(actor?.email || '').toLowerCase(),
    String(actor?.role || 'user'),
    normalizeCompanyCode(actor?.company_code),
    String(actor?.ts || ''),
  ].join('|');
}

// Firma la identidad del usuario que actúa, para que la función de TLEC pueda confiar en ella.
export async function signCompanyActor(company, actor) {
  const email = String(actor?.email || '').trim();
  if (!email) return null;
  const payload = {
    email,
    role: actor?.role === 'admin' ? 'admin' : 'user',
    company_code: company?.company_code || PLATFORM_COMPANY_CODE,
    name: String(actor?.name || '').slice(0, 80),
    ts: Date.now(),
  };
  const secret = company?.is_platform_owner
    ? (platformServiceKey() || company?.service_key || '')
    : (company?.service_key || '');
  payload.sig = secret ? await hmacHex(secret, actorSignatureMessage(payload)) : '';
  return payload;
}

export async function resolveActor(base44, req, body) {
  // 1) Sesión real de TLEC
  try {
    const user = await base44.auth.me();
    if (user?.email) {
      return {
        email: user.email,
        role: user.role === 'admin' ? 'admin' : 'user',
        company_code: PLATFORM_COMPANY_CODE,
        name: user.full_name || '',
        source: 'tlec_session',
      };
    }
  } catch (_) {}

  // 2) Empleado o cliente de una empresa socia, firmado por la llave de esa empresa
  const payload = body?._company_actor;
  if (!payload?.email || !payload?.sig) return null;
  const ts = Number(payload.ts || 0);
  if (!ts || Math.abs(Date.now() - ts) > ACTOR_MAX_AGE_MS) return null;
  const code = normalizeCompanyCode(payload.company_code);
  if (!code || code === PLATFORM_COMPANY_CODE) return null;

  const rows = await base44.asServiceRole.entities.Company
    .filter({ company_code: code }, '-created_date', 1)
    .catch(() => null);
  const company = rows?.[0];
  if (!company || String(company.status) !== 'activa' || !company.service_key) return null;

  const expected = await hmacHex(company.service_key, actorSignatureMessage(payload));
  if (expected !== String(payload.sig)) return null;

  return {
    email: payload.email,
    role: payload.role === 'admin' ? 'admin' : 'user',
    company_code: company.company_code,
    company_name: company.name || '',
    name: payload.name || '',
    source: 'company_channel',
  };
}

export async function resolveAdminActor(base44, req, body) {
  const actor = await resolveActor(base44, req, body);
  if (!actor) return { error: 'Unauthorized', status: 401 };
  if (actor.role !== 'admin') return { error: 'Solo administradores', status: 403 };
  return { actor };
}