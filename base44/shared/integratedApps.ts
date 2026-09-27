// Utilidades compartidas por las funciones que atienden a las apps duplicadas.
// Aquí vive la generación/verificación de claves, el marcado de origen y el
// control de alcance por origen. No duplicar esta lógica en ninguna función.

export const KEY_PREFIX = 'tlec_';

const ALPHABET = 'abcdefghijkmnopqrstuvwxyz23456789';

export function generateAppKey() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return `${KEY_PREFIX}${out}`;
}

export async function hashAppKey(rawKey) {
  const data = new TextEncoder().encode(String(rawKey || ''));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function keyLabel(rawKey) {
  return `${String(rawKey || '').slice(0, 12)}…`;
}

export function slugify(value, fallback = 'app') {
  const clean = String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return clean || fallback;
}

export function originStamp(app) {
  return { origin_app_id: app.id, origin_app_label: app.name };
}

export function ownedByApp(record, appId) {
  return !!record && record.origin_app_id === appId;
}

export function errorResponse(code, message, status = 400) {
  return Response.json({ ok: false, error: { code, message } }, { status });
}

// Marca de uso de la copia (última conexión + contador de llamadas)
export async function touchIntegratedApp(base44, app, actionLabel) {
  try {
    await base44.asServiceRole.entities.IntegratedApp.update(app.id, {
      last_seen: new Date().toISOString(),
      last_action: actionLabel,
      call_count: (Number(app.call_count) || 0) + 1
    });
  } catch (_) {
    // el contador no debe romper la llamada del cliente
  }
}

// Busca la copia dueña de una clave. Devuelve { app } o { error }.
export async function authenticateIntegratedApp(base44, rawKey) {
  if (!rawKey) {
    return { error: errorResponse('missing_key', 'Falta la cabecera x-app-key con la clave de la app integrada.', 401) };
  }
  const keyHash = await hashAppKey(rawKey);
  const matches = await base44.asServiceRole.entities.IntegratedApp.filter(
    { key_hash: keyHash },
    '-created_date',
    1
  );
  const app = matches?.[0];
  if (!app) {
    return { error: errorResponse('invalid_key', 'La clave enviada no corresponde a ninguna app integrada.', 401) };
  }
  if (app.active === false) {
    return { error: errorResponse('app_disabled', 'Esta app integrada está desactivada en TLEC CARGO.', 403) };
  }
  return { app };
}