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

// Correo reservado con el que cada copia ejecuta su prueba de ida y vuelta.
// El dominio .local garantiza que nunca coincida con un cliente real.
export const TEST_EMAIL_PREFIX = 'prueba-sync+';
export const TEST_EMAIL_DOMAIN = 'tlec-test.local';

export function testClientEmail(slug) {
  return `${TEST_EMAIL_PREFIX}${String(slug || 'app').trim().toLowerCase()}@${TEST_EMAIL_DOMAIN}`;
}

export function testClientMark(slug) {
  return `PRUEBA-${String(slug || 'app').trim().toUpperCase()}`;
}

export function isTestEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!email) return false;
  const [user, domain] = email.split('@');
  return !!user && !!domain && user.startsWith(TEST_EMAIL_PREFIX) && domain === TEST_EMAIL_DOMAIN;
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
// Toda llamada rechazada se anota en el registro de su copia: así una clave
// equivocada deja de verse igual que el silencio total.
export async function authenticateIntegratedApp(base44, rawKey, actionLabel) {
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
    await recordRejection(base44, rawKey, 'La clave no corresponde a ninguna app integrada', actionLabel);
    return { error: errorResponse('invalid_key', 'La clave enviada no corresponde a ninguna app integrada.', 401) };
  }
  if (app.active === false) {
    await logRejection(base44, app, 'La conexión está desactivada en TLEC CARGO', actionLabel);
    return { error: errorResponse('app_disabled', 'Esta app integrada está desactivada en TLEC CARGO.', 403) };
  }
  return { app };
}

// Reporte de estado que la copia adjunta al cerrar su ciclo de sincronización.
// Queda guardado en su propio registro para que TLEC CARGO pueda diagnosticarla.
export async function saveStatusReport(base44, app, report) {
  const data = report && typeof report === 'object' ? report : {};
  const missing = Array.isArray(data.missing) ? data.missing.map((v) => String(v)).slice(0, 5) : [];
  const changes = {
    report_date: new Date().toISOString(),
    report_configured: data.configured !== false,
    report_missing: missing,
    report_pending: Number(data.pending) || 0,
    report_error: String(data.last_error || '').slice(0, 500),
    report_error_date: data.last_error_date || null
  };

  // El resultado de la prueba de ida y vuelta viaja dentro del mismo reporte.
  const test = data.test && typeof data.test === 'object' ? data.test : null;
  if (test) {
    changes.test_date = test.date || new Date().toISOString();
    changes.test_ok = test.ok === true;
    changes.test_steps = Array.isArray(test.steps)
      ? test.steps.slice(0, 10).map((row) => ({
        step: String(row?.step || '').slice(0, 40),
        label: String(row?.label || row?.step || '').slice(0, 80),
        ok: row?.ok === true,
        detail: String(row?.detail || '').slice(0, 300)
      }))
      : [];
    changes.test_leftovers = Array.isArray(test.leftovers) ? test.leftovers.map((v) => String(v).slice(0, 120)).slice(0, 10) : [];
    changes.test_requested_date = null;
    changes.test_requested_by = '';
  }

  try {
    await base44.asServiceRole.entities.IntegratedApp.update(app.id, changes);
  } catch (_) {
    // el reporte nunca debe romper la llamada de la copia
  }
}

// Anota un rechazo en el registro de una copia ya identificada.
export async function logRejection(base44, app, reason, actionLabel) {
  try {
    await base44.asServiceRole.entities.IntegratedApp.update(app.id, {
      rejected_count: (Number(app.rejected_count) || 0) + 1,
      rejected_last_date: new Date().toISOString(),
      rejected_last_reason: String(reason || '').slice(0, 300),
      rejected_last_action: String(actionLabel || '').slice(0, 200)
    });
  } catch (_) {
    // el registro del rechazo nunca debe romper la respuesta al que llamó
  }
}

// Busca a qué copia pertenece la clave rechazada, incluidas las claves ya rotadas.
export async function recordRejection(base44, rawKey, reason, actionLabel) {
  try {
    const label = keyLabel(rawKey);
    if (!label) return;
    const apps = await base44.asServiceRole.entities.IntegratedApp.list('-created_date', 100);
    const app = (apps || []).find(
      (row) => row.key_prefix === label || (Array.isArray(row.key_prefixes) && row.key_prefixes.includes(label))
    );
    if (!app) return;
    await logRejection(base44, app, reason, actionLabel);
  } catch (_) {
    // sin atribución posible: no hay a quién anotarle el rechazo
  }
}