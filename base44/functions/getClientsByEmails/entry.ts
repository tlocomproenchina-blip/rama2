import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// =====================================================================
// Cruce CONFIABLE factura/registro -> cliente por lista de emails.
//
// Resuelve el problema "cada pantalla carga User.list() y se queda corta":
// recibe una lista de emails y devuelve los datos normalizados de esos
// clientes, sin importar en qué página de la base estén.
//
// Reutiliza el mismo "sanitize" que listClientsForSupport para mantener
// un único formato de datos de cliente en todo el backend.
// =====================================================================

const CACHE_TTL_MS = 60 * 1000;
let _cache = { at: 0, byEmail: null };

function sanitize(u) {
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
    stripe_customer_id: u.stripe_customer_id || null,
    created_date: u.created_date,
    role: u.role || 'user',
    custom_role: u.custom_role || null,
  };
}

async function loadAllClientsByEmail(base44) {
  const PAGE = 200;
  let skip = 0;
  const byEmail = {};
  while (true) {
    const batch = await base44.asServiceRole.entities.User.filter({ role: 'user' }, '-created_date', PAGE, skip);
    if (!batch || batch.length === 0) break;
    for (const u of batch) {
      if (u && u.email && u.custom_role !== 'super_admin_oculto') {
        byEmail[u.email] = sanitize(u);
      }
    }
    if (batch.length < PAGE) break;
    skip += PAGE;
    if (skip >= 5000) break; // safety guard
  }
  return byEmail;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allowed = user.role === 'admin' || user.custom_role === 'customer_service';
    if (!allowed) {
      return Response.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const emails = Array.isArray(body.emails) ? body.emails.filter(Boolean) : [];
    const forceRefresh = body.forceRefresh === true;

    const now = Date.now();
    const cacheValid = !forceRefresh && _cache.byEmail && (now - _cache.at) < CACHE_TTL_MS;

    let byEmail;
    if (cacheValid) {
      byEmail = _cache.byEmail;
    } else {
      byEmail = await loadAllClientsByEmail(base44);
      _cache = { at: now, byEmail };
    }

    // Si no se piden emails específicos, devolver el índice completo.
    if (emails.length === 0) {
      return Response.json({ clients: byEmail, total: Object.keys(byEmail).length });
    }

    // Devolver solo los solicitados (índice email -> cliente).
    const result = {};
    for (const email of emails) {
      if (byEmail[email]) result[email] = byEmail[email];
    }

    return Response.json({ clients: result, total: Object.keys(result).length });
  } catch (error) {
    console.error('getClientsByEmails error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});