// =====================================================================
// PUNTO ÚNICO DE VERDAD para los datos de un cliente (frontend).
//
// Toda pantalla que necesite mostrar/derivar datos de un cliente
// (nombre, cédula, shipping mark, contacto, etc.) debe usar estos
// helpers en lugar de leer los campos crudos por su cuenta.
//
// Así evitamos que el mismo bug (campo faltante, nombre vacío) reaparezca
// pantalla por pantalla: se arregla aquí una vez y aplica a todas.
// =====================================================================

/**
 * Normaliza un registro de cliente (User) a una forma consistente.
 * Acepta un objeto User crudo y devuelve siempre los mismos campos.
 * Tolerante a null/undefined.
 */
export function normalizeClient(user) {
  const u = user || {};
  const first = (u.first_name || '').trim();
  const last = (u.last_name || '').trim();

  return {
    id: u.id || null,
    email: u.email || null,
    first_name: first || null,
    last_name: last || null,
    full_name: u.full_name || null,
    cedula: u.cedula || null,
    shipping_mark: u.shipping_mark || null,
    whatsapp: u.whatsapp || null,
    phone: u.phone || null,
    state: u.state || null,
    city: u.city || null,
    address: u.address || null,
    is_active: u.is_active !== false,
    profile_completed: !!u.profile_completed,
    stripe_customer_id: u.stripe_customer_id || null,
    role: u.role || 'user',
    custom_role: u.custom_role || null,
  };
}

/**
 * Nombre para mostrar del cliente, con fallbacks en cascada:
 * "Nombre Apellido" → full_name → email → "Cliente".
 * Nunca devuelve cadena vacía.
 */
export function getClientDisplayName(user) {
  const u = user || {};
  const composed = `${u.first_name || ''} ${u.last_name || ''}`.trim();
  return composed || u.full_name || u.email || 'Cliente';
}

/**
 * Línea secundaria para mostrar bajo el nombre (shipping mark o email).
 */
export function getClientSubtitle(user) {
  const u = user || {};
  return u.shipping_mark || u.email || '';
}

/**
 * Construye un índice email → cliente a partir de una lista de Users.
 * Útil para cruces rápidos (factura → cliente) sin recorrer la lista
 * en cada render.
 */
export function buildClientIndex(users) {
  const index = {};
  for (const u of users || []) {
    if (u && u.email) index[u.email] = u;
  }
  return index;
}

/**
 * Busca un cliente por email dentro de una lista o índice y lo normaliza.
 * `source` puede ser un array de Users o un índice (email → User).
 * Siempre devuelve un objeto normalizado (nunca undefined).
 */
export function findClient(source, email) {
  if (!email) return normalizeClient(null);
  let raw = null;
  if (Array.isArray(source)) {
    raw = source.find((c) => c && c.email === email) || null;
  } else if (source && typeof source === 'object') {
    raw = source[email] || null;
  }
  // Garantiza que el email siempre esté presente aunque no haya match.
  return normalizeClient(raw || { email });
}