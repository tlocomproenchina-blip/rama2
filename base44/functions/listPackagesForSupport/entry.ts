import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Cache en memoria para conteos globales (no dependen de los filtros del usuario).
// Evita recalcular ~350k registros cada vez que el admin cambia un filtro.
const COUNTS_TTL_MS = 3 * 60 * 1000; // 3 min — los conteos globales no necesitan ser en tiempo real
let _countsCache = { at: 0, counts: null };

// Lista paquetes para AdminPackages con paginación, filtros y conteos server-side
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const {
      limit = 50,
      skip = 0,
      q = '',
      statusFilter = 'all',
      reportedFilter = 'all',
      advancedFilters = null,
      includeCounts = true,
    } = body || {};

    const pageLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const pageSkip = Math.max(Number(skip) || 0, 0);

    // === Construcción del query MongoDB ===
    const query = {};
    const andClauses = [];

    // Status filter
    if (statusFilter === 'pre_alerta_no_recibido') {
      query.status = 'pre_alerta';
      query.received_date = { $in: [null] };
    } else if (statusFilter === 'stale') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      query.status = 'pre_alerta';
      query.created_date = { $lte: sevenDaysAgo };
    } else if (statusFilter && statusFilter !== 'all') {
      query.status = statusFilter;
    }

    // Reported filter
    if (reportedFilter === 'reported') {
      query.reported = true;
    } else if (reportedFilter === 'unreported') {
      query.reported = { $ne: true };
    }

    // Advanced filters
    if (advancedFilters && typeof advancedFilters === 'object') {
      const { tracking, email, shippingMark, status, shippingType, dateFrom, dateTo, hasInsurance } = advancedFilters;
      if (tracking) {
        const r = String(tracking).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query.tracking_number = { $regex: r, $options: 'i' };
      }
      if (email) {
        const r = String(email).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query.client_email = { $regex: r, $options: 'i' };
      }
      if (shippingMark) {
        const r = String(shippingMark).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query.shipping_mark = { $regex: r, $options: 'i' };
      }
      if (status && status !== 'all') {
        // Si advanced trae status, sobrescribe
        query.status = status;
      }
      if (shippingType && shippingType !== 'all') {
        query.shipping_type = shippingType;
      }
      if (hasInsurance === 'true' || hasInsurance === true) query.has_insurance = true;
      if (hasInsurance === 'false' || hasInsurance === false && hasInsurance !== 'all') query.has_insurance = { $ne: true };
      // NOTA: created_date es un campo built-in que NO soporta $gte/$lte en el SDK.
      // El filtro de fechas se aplica en JavaScript después de fetch (ver más abajo).
    }

    // Búsqueda libre: tracking, shipping_mark, client_email, description
    // Y también busca usuarios para obtener emails coincidentes (por nombre/shipping_mark)
    if (q && String(q).trim().length > 0) {
      const term = String(q).trim();
      const r = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const orClauses = [
        { tracking_number: { $regex: r, $options: 'i' } },
        { shipping_mark: { $regex: r, $options: 'i' } },
        { client_email: { $regex: r, $options: 'i' } },
        { description: { $regex: r, $options: 'i' } },
      ];

      // Buscar usuarios coincidentes para incluir sus emails
      try {
        const [byEmail, byMark, byName] = await Promise.all([
          base44.asServiceRole.entities.User.filter({ email: { $regex: r, $options: 'i' } }, '-updated_date', 10).catch(() => []),
          base44.asServiceRole.entities.User.filter({ shipping_mark: { $regex: r, $options: 'i' } }, '-updated_date', 10).catch(() => []),
          base44.asServiceRole.entities.User.filter({ full_name: { $regex: r, $options: 'i' } }, '-updated_date', 10).catch(() => []),
        ]);
        const matchingEmails = Array.from(new Set([...byEmail, ...byMark, ...byName].map(u => u.email).filter(Boolean)));
        if (matchingEmails.length > 0) {
          orClauses.push({ client_email: { $in: matchingEmails } });
        }
      } catch (_) {}

      andClauses.push({ $or: orClauses });
    }

    const finalQuery = andClauses.length > 0
      ? { $and: [query, ...andClauses] }
      : query;

    // === Página + conteos globales en paralelo ===
    // OPTIMIZACIÓN: Ya no se descargan todos los registros para contarlos.
    // Se pide pageLimit+1: si llegan más, hay siguiente página (hasMore).
    // El total exacto solo se devuelve cuando no hay filtros (usa counts.total).
    const fetchGlobalCounts = async () => {
      const now = Date.now();
      if (_countsCache.counts && (now - _countsCache.at) < COUNTS_TTL_MS) return _countsCache.counts;
      const staleThreshold = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
      const acc = { total: 0, pre_alerta_no_recibido: 0, recibido: 0, consolidado: 0, en_transito: 0, entregado: 0, stale: 0 };
      const B = 1000;
      let s = 0;
      while (true) {
        const batch = await base44.asServiceRole.entities.Package.list('-created_date', B, s);
        if (!batch || batch.length === 0) break;
        for (const p of batch) {
          acc.total++;
          const st = p?.status;
          if (st === 'recibido') acc.recibido++;
          else if (st === 'consolidado') acc.consolidado++;
          else if (st === 'en_transito') acc.en_transito++;
          else if (st === 'entregado') acc.entregado++;
          else if (st === 'pre_alerta') {
            if (!p.received_date) acc.pre_alerta_no_recibido++;
            if (p.created_date && p.created_date <= staleThreshold) acc.stale++;
          }
        }
        if (batch.length < B) break;
        s += B;
        if (s > 50000) break; // safety cap
      }
      _countsCache = { at: now, counts: acc };
      return acc;
    }

    // Pedir 1 extra para detectar si hay más páginas sin contar todo.
    // Si hay filtro de fechas (que se aplica en JS), fetch un lote más grande
    // para compensar los registros que se filtrarán client-side.
    const hasDateFilter = advancedFilters && (advancedFilters.dateFrom || advancedFilters.dateTo);
    const fetchSize = hasDateFilter ? Math.min(pageLimit * 10, 500) + 1 : pageLimit + 1;
    const [rawData, counts] = await Promise.all([
      base44.asServiceRole.entities.Package.filter(finalQuery, '-created_date', fetchSize, pageSkip),
      includeCounts ? fetchGlobalCounts() : Promise.resolve(null),
    ]);

    // Filtrar por fechas en JavaScript (created_date no soporta $gte/$lte en el SDK)
    let filtered = rawData;
    if (hasDateFilter) {
      const fromTime = advancedFilters.dateFrom ? new Date(advancedFilters.dateFrom + 'T00:00:00').getTime() : 0;
      const toTime = advancedFilters.dateTo ? new Date(advancedFilters.dateTo + 'T23:59:59').getTime() : Infinity;
      filtered = rawData.filter(p => {
        if (!p?.created_date) return false;
        const t = new Date(p.created_date).getTime();
        return t >= fromTime && t <= toTime;
      });
    }

    const hasMore = filtered.length > pageLimit;
    const data = hasMore ? filtered.slice(0, pageLimit) : filtered;

    // Total exacto solo cuando no hay filtros (usa counts.total del cache global).
    // Con filtros, devolvemos null — la UI muestra el conteo cargado en su lugar.
    const hasActiveFilter = !!(q && String(q).trim()) || statusFilter !== 'all' || reportedFilter !== 'all' || (advancedFilters && Object.keys(advancedFilters).length > 0);
    const total = (!hasActiveFilter && counts) ? counts.total : null;

    // === Enriquecer con datos del cliente (whatsapp, nombre) ===
    // Lookup batched por email para mostrar botón de contacto WhatsApp
    try {
      const emails = Array.from(new Set(data.map(p => p?.client_email).filter(Boolean)));
      if (emails.length > 0) {
        const users = await base44.asServiceRole.entities.User.filter({ email: { $in: emails } }, '-updated_date', emails.length).catch(() => []);
        const userByEmail = new Map();
        for (const u of users) {
          if (u?.email) userByEmail.set(u.email, u);
        }
        for (const p of data) {
          const u = userByEmail.get(p.client_email);
          if (u) {
            p.client_whatsapp = u.whatsapp || u.phone || '';
            p.client_name = u.full_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || '';
          }
        }
      }
    } catch (_) { /* no bloquear listado por error de lookup */ }

    return Response.json({ data, total, skip: pageSkip, limit: pageLimit, hasMore, counts });
  } catch (error) {
    console.error('listPackagesForSupport error:', error);
    return Response.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
});