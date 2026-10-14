// Sanitización compartida para datos de usuario devueltos por el backend.
// Evita filtrar campos sensibles y mantiene un formato consistente en todas
// las funciones que exponen datos de usuarios al frontend.

export function sanitizeUser(u: any) {
  return {
    id: u.id,
    email: u.email,
    full_name: u.full_name || null,
    first_name: u.first_name || null,
    last_name: u.last_name || null,
    cedula: u.cedula || null,
    state: u.state || null,
    city: u.city || null,
    address: u.address || null,
    whatsapp: u.whatsapp || null,
    phone: u.phone || null,
    shipping_mark: u.shipping_mark || null,
    profile_completed: !!u.profile_completed,
    is_active: u.is_active !== false,
    referral_code: u.referral_code || null,
    referred_by_code: u.referred_by_code || null,
    referred_by_user_id: u.referred_by_user_id || null,
    created_date: u.created_date,
    updated_date: u.updated_date,
    role: u.role || 'user',
    custom_role: u.custom_role || null,
    billing_use_registration: u.billing_use_registration !== false ? true : false,
    billing_name: u.billing_name || null,
    billing_cedula_rif: u.billing_cedula_rif || null,
    billing_phone: u.billing_phone || null,
    billing_address: u.billing_address || null,
    billing_rif_image_url: u.billing_rif_image_url || null,
  };
}

// Normalización para búsqueda (mismos helpers que listClientsForSupport)
export const removeDiacritics = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export const normalizeText = (s: string) => removeDiacritics(s).toLowerCase().replace(/\s+/g, ' ').trim();
export const normalizeAlnum = (s: string) => normalizeText(s).replace(/[^a-z0-9]/g, '');
export const getDigits = (s: string) => (s || '').replace(/\D/g, '');

export function userMatchesSearch(u: any, q: string): boolean {
  if (!q) return true;
  const qText = normalizeText(q);
  const qAlnum = normalizeAlnum(q);
  const qDigits = getDigits(q);

  const email = normalizeText(u.email || '');
  const first = normalizeText(u.first_name || '');
  const last = normalizeText(u.last_name || '');
  const full = `${first} ${last}`.trim();
  const fullName = normalizeText(u.full_name || '');
  const cityNorm = normalizeText(u.city || '');
  const wa = getDigits(u.whatsapp || '');
  const ph = getDigits(u.phone || '');
  const sm = normalizeAlnum(u.shipping_mark || '');
  const fullAlnum = normalizeAlnum((u.first_name || '') + (u.last_name || ''));
  // Cédula y cédula/RIF de facturación: sin letras ni guiones, así
  // "V-12345678", "12345678" y "v12345678" encuentran al mismo cliente.
  const ced = normalizeAlnum(u.cedula || '');
  const billingCed = normalizeAlnum(u.billing_cedula_rif || '');

  if (qText && (email.includes(qText) || first.includes(qText) || last.includes(qText) || full.includes(qText) || fullName.includes(qText) || cityNorm.includes(qText))) return true;
  if (qDigits && (wa.includes(qDigits) || ph.includes(qDigits))) return true;
  if (qAlnum && (sm.includes(qAlnum) || fullAlnum.includes(qAlnum))) return true;
  // La cédula es un identificador directo del cliente: se admite coincidencia parcial.
  if (qAlnum && ((ced && ced.includes(qAlnum)) || (billingCed && billingCed.includes(qAlnum)))) return true;
  return false;
}