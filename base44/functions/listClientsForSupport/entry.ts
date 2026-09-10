import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Cache en memoria (vive lo que viva el isolate). Evita recalcular conteos
// pesados en requests sucesivos del mismo admin filtrando.
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutos — reduce recargas costosas
let _cache = { at: 0, allClients: null, packageCounts: null };

// Helpers de normalización (mismos del frontend)
const removeDiacritics = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const normalizeText = (s) => removeDiacritics(s).toLowerCase().replace(/\s+/g, ' ').trim();
const normalizeAlnum = (s) => normalizeText(s).replace(/[^a-z0-9]/g, '');
const getDigits = (s) => (s || '').replace(/\D/g, '');

// Carga TODOS los users con role='user' usando paginación interna
async function loadAllClients(base44) {
  const PAGE = 500;
  let skip = 0;
  let all = [];
  while (true) {
    const batch = await base44.asServiceRole.entities.User.filter({ role: 'user' }, '-created_date', PAGE, skip);
    if (!batch || batch.length === 0) break;
    all = all.concat(batch);
    if (batch.length < PAGE) break;
    skip += PAGE;
    if (skip >= 5000) break; // safety guard
  }
  return all;
}

// Suma el balance de crédito SOLO de los clientes de la página devuelta.
// Antes se escaneaba la tabla completa de ClientCredit en cada petición.
async function loadCreditBalancesFor(base44, emails) {
  const balances = {};
  const rows = await base44.asServiceRole.entities.ClientCredit
    .filter({ client_email: { $in: emails } }, '-created_date', 2000)
    .catch(() => []);
  for (const c of rows) {
    if (!c.client_email) continue;
    balances[c.client_email] = (balances[c.client_email] || 0) + (Number(c.amount) || 0);
  }
  return balances;
}

// Conteo de paquetes por cliente. Solo se usa para los stat cards y para las
// categorías "con/sin paquetes", así que solo se carga cuando hace falta.
async function loadAllPackageCounts(base44) {
  const counts = {};
  const PAGE = 1000;
  let s = 0;
  while (true) {
    const batch = await base44.asServiceRole.entities.Package.list('-created_date', PAGE, s);
    if (!batch || batch.length === 0) break;
    for (const p of batch) {
      if (p.client_email) counts[p.client_email] = (counts[p.client_email] || 0) + 1;
    }
    if (batch.length < PAGE) break;
    s += PAGE;
    if (s >= 50000) break; // safety
  }
  return counts;
}

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
    billing_use_registration: u.billing_use_registration !== false ? true : false,
    billing_name: u.billing_name || null,
    billing_cedula_rif: u.billing_cedula_rif || null,
    billing_phone: u.billing_phone || null,
    billing_address: u.billing_address || null,
    billing_rif_image_url: u.billing_rif_image_url || null,
  };
}

function isIncomplete(c) {
  return !c.first_name || !c.last_name || !c.whatsapp || !c.state || !c.city || !c.address;
}
function hasMark(c) {
  return !!(c.shipping_mark && String(c.shipping_mark).trim().length > 0);
}

// Extrae el número secuencial final de un shipping mark con patrón ...-TLEC-NNNNN
// (mismo parser que generateClientsTxtReport). Devuelve null si no coincide.
function parseShippingMarkNumber(mark) {
  if (!mark || typeof mark !== 'string') return null;
  const match = mark.match(/TLEC-(\d+)\s*$/i);
  return match ? parseInt(match[1], 10) : null;
}

// Lee el cursor global de reporte TXT y devuelve el último número reportado (0 si no hay cursor).
async function getReportCursorNumber(base44) {
  try {
    const rows = await base44.asServiceRole.entities.ClientReportCursor.filter({ config_key: 'main' }, '-updated_date', 1);
    return Number(rows?.[0]?.last_shipping_mark_number) || 0;
  } catch (_) {
    return 0;
  }
}

function matchesSearch(c, q, exact = false) {
  if (!q) return true;
  const qText = normalizeText(q);
  const qAlnum = normalizeAlnum(q);
  // Solo extraer dígitos cuando la consulta es completamente numérica.
  // Si la consulta tiene letras (ej: "1483s"), no se hace matching por
  // dígitos sueltos contra teléfonos, lo que producía resultados falsos.
  const isAllDigits = /^\d+$/.test(q.trim());
  const qDigits = isAllDigits ? getDigits(q) : '';

  const email = normalizeText(c.email || '');
  const first = normalizeText(c.first_name || '');
  const last = normalizeText(c.last_name || '');
  const full = `${first} ${last}`.trim();
  const cityNorm = normalizeText(c.city || '');
  const wa = getDigits(c.whatsapp || '');
  const ph = getDigits(c.phone || '');
  const sm = normalizeAlnum(c.shipping_mark || '');
  const fullAlnum = normalizeAlnum((c.first_name || '') + (c.last_name || ''));

  if (exact) {
    // Coincidencias exactas (tras normalizar) en cualquiera de los campos
    if (qText && (email === qText || first === qText || last === qText || full === qText || cityNorm === qText)) return true;
    if (qDigits && (wa === qDigits || ph === qDigits)) return true;
    if (qAlnum && (sm === qAlnum || fullAlnum === qAlnum)) return true;
    return false;
  }

  if (qText && (email.includes(qText) || first.includes(qText) || last.includes(qText) || full.includes(qText) || cityNorm.includes(qText))) return true;
  // Solo buscar en teléfono/WhatsApp si la consulta tiene 5+ dígitos:
  // cadenas cortas como "1483" deben coincidir con shipping marks, no con
  // números de teléfono que contengan esos dígitos por casualidad.
  if (qDigits && qDigits.length >= 5 && (wa.includes(qDigits) || ph.includes(qDigits))) return true;
  if (qAlnum && (sm.includes(qAlnum) || fullAlnum.includes(qAlnum))) return true;
  return false;
}

function matchesCategory(c, key, pkgCount, cursorNumber = 0) {
  switch (key) {
    case 'with_mark': return hasMark(c);
    case 'without_mark': return !hasMark(c);
    case 'pending': {
      // Mismo criterio que el contador: shipping mark numérico > cursor reportado
      const markNum = parseShippingMarkNumber(c.shipping_mark);
      return markNum != null && markNum > cursorNumber;
    }
    case 'incomplete': return isIncomplete(c);
    case 'active': return c.is_active !== false;
    case 'inactive': return c.is_active === false;
    case 'with_packages': return pkgCount > 0;
    case 'without_packages': return pkgCount === 0;
    case 'with_whatsapp': return !!c.whatsapp;
    case 'without_whatsapp': return !c.whatsapp;
    default: return true;
  }
}

function matchesState(c, stateFilter) {
  if (!stateFilter || stateFilter === 'all') return true;
  // El estado guardado puede ser código o nombre. Si tiene espacio asumimos nombre completo (no filtrar).
  const stored = c.state || '';
  if (stored.includes(' ')) return false;
  return stored === stateFilter;
}

function matchesDate(c, fromDate, toDate, quickDate) {
  const cd = c.created_date ? new Date(c.created_date) : null;
  if (!cd) return true;

  if (fromDate || toDate) {
    const start = fromDate ? new Date(`${fromDate}T00:00:00`) : new Date(0);
    const end = toDate ? new Date(`${toDate}T23:59:59.999`) : new Date();
    return cd >= start && cd <= end;
  }
  if (quickDate && quickDate !== 'all') {
    const now = new Date();
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
    let threshold = startToday;
    if (quickDate === '7d') threshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    else if (quickDate === '30d') threshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return cd >= threshold;
  }
  return true;
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
    const limit = Math.min(Math.max(parseInt(body.limit) || 50, 1), 200);
    const skip = Math.max(parseInt(body.skip) || 0, 0);
    const q = (body.q || '').toString().trim();
    const exclusiveKey = body.exclusiveKey || 'all';
    const stateFilter = body.stateFilter || 'all';
    const fromDate = body.fromDate || '';
    const toDate = body.toDate || '';
    const quickDate = body.quickDate || 'all';
    const includeCounts = body.includeCounts !== false; // por defecto sí
    const forceRefresh = body.forceRefresh === true;
    const exact = body.exact === true;

    // Carga todos los clientes y los conteos de paquetes (con caché TTL).
    // Esto resuelve el problema "N+1 / recalcular siempre": cuando el admin
    // cambia filtros varias veces, no recargamos miles de paquetes en cada click.
    const now = Date.now();
    // Cuando se calculan los conteos (stat cards), forzamos lectura fresca de
    // clientes para que "Pendientes" refleje shipping marks recién asignados.
    // La caché solo sirve para la lista paginada y los conteos de paquetes.
    const clientsValid = !forceRefresh && !includeCounts && _cache.allClients && (now - _cache.at) < CACHE_TTL_MS;

    // Los conteos de paquetes solo hacen falta para los stat cards y para las
    // categorías "con/sin paquetes". El buscador (includeCounts: false) ya no
    // paga el escaneo completo de la tabla de paquetes.
    const needsPackageCounts = includeCounts || exclusiveKey === 'with_packages' || exclusiveKey === 'without_packages';
    const cachedPkgCounts = clientsValid ? _cache.packageCounts : null;

    const [clientsRes, pkgRes] = await Promise.all([
      clientsValid ? Promise.resolve(null) : loadAllClients(base44),
      (needsPackageCounts && !cachedPkgCounts) ? loadAllPackageCounts(base44) : Promise.resolve(null),
    ]);

    const all = clientsRes
      ? clientsRes
          .filter((u) => u && u.id && u.email && u.custom_role !== 'super_admin_oculto')
          .map(sanitize)
      : _cache.allClients;
    const packageCounts = pkgRes || cachedPkgCounts || {};

    _cache = {
      at: clientsValid ? _cache.at : now,
      allClients: all,
      packageCounts: pkgRes || cachedPkgCounts,
    };

    // Cursor de reporte TXT (para filtro 'pending' y conteo)
    const cursorNumber = await getReportCursorNumber(base44);

    // Aplicar filtros
    const filtered = all.filter((c) => {
      const pkgCount = packageCounts[c.email] || 0;
      if (!matchesSearch(c, q, exact)) return false;
      if (!matchesCategory(c, exclusiveKey, pkgCount, cursorNumber)) return false;
      if (!matchesState(c, stateFilter)) return false;
      if (!matchesDate(c, fromDate, toDate, quickDate)) return false;
      return true;
    });

    // Conteos globales (sobre TODA la lista, sin filtros) para los stat cards
    let counts = null;
    if (includeCounts) {
      // "Pendientes" = clientes con shipping mark numérico mayor al último reportado.
      // Refleja cuántos clientes se han registrado desde el último reporte TXT.
      counts = {
        total: all.length,
        withMark: 0, withoutMark: 0, pending: 0, incomplete: 0,
        active: 0, inactive: 0,
        withPackages: 0, withoutPackages: 0,
        withWhatsapp: 0, withoutWhatsapp: 0,
        totalPackages: 0,
      };
      for (const c of all) {
        const pkgCount = packageCounts[c.email] || 0;
        const validMark = hasMark(c);
        const incomplete = isIncomplete(c);
        if (validMark) counts.withMark++; else counts.withoutMark++;
        // Pendientes por reportar: shipping mark numérico > cursor
        const markNum = parseShippingMarkNumber(c.shipping_mark);
        if (markNum != null && markNum > cursorNumber) counts.pending++;
        if (incomplete) counts.incomplete++;
        if (c.is_active === false) counts.inactive++; else counts.active++;
        if (pkgCount > 0) counts.withPackages++; else counts.withoutPackages++;
        if (c.whatsapp) counts.withWhatsapp++; else counts.withoutWhatsapp++;
        counts.totalPackages += pkgCount;
      }
    }

    // Paginar la lista filtrada
    const total = filtered.length;
    const page = filtered.slice(skip, skip + limit);

    // Balance de crédito solo de los clientes visibles en esta página
    const pageEmails = page.map((c) => c.email).filter(Boolean);
    if (pageEmails.length > 0) {
      const balances = await loadCreditBalancesFor(base44, pageEmails);
      for (const c of page) c.credit_balance = balances[c.email] || 0;
    }

    return Response.json({
      data: page,
      total,
      skip,
      limit,
      hasMore: skip + page.length < total,
      counts,
      packageCounts: includeCounts ? packageCounts : null,
    });
  } catch (error) {
    console.error('listClientsForSupport error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});