import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Cache en memoria para conteos globales (no dependen de los filtros del usuario).
// Evita recalcular ~350k registros cada vez que el admin cambia un filtro.
const COUNTS_TTL_MS = 60 * 1000; // 60s
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
      if (dateFrom || dateTo) {
        const dateQuery = {};
        if (dateFrom) dateQuery.$gte = new Date(dateFrom).toISOString();
        if (dateTo) dateQuery.$lte = new Date(dateTo + 'T23:59:59').toISOString();
        query.created_date = { ...(query.created_date || {}), ...dateQuery };
      }
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

    // === Página actual ===
    const data = await base44.asServiceRole.entities.Package.filter(finalQuery, '-created_date', pageLimit, pageSkip);

    // === Total que coincide ===
    let total = 0;
    if (data.length < pageLimit && pageSkip === 0) {
      total = data.length;
    } else {
      // Contar total iterando (limit alto, skip 0 solo para count)
      let countSkip = 0;
      const COUNT_BATCH = 1000;
      while (true) {
        const batch = await base44.asServiceRole.entities.Package.filter(finalQuery, '-created_date', COUNT_BATCH, countSkip);
        total += batch.length;
        if (batch.length < COUNT_BATCH) break;
        countSkip += COUNT_BATCH;
        if (countSkip > 50000) break; // safety cap
      }
    }

    const hasMore = pageSkip + data.length < total;

    // === Conteos globales (todos los paquetes, ignorando filtros) ===
    // Optimización: usamos UNA sola pasada paginada sobre Package, agrupando
    // en memoria por estado, en vez de 7 queries que recorren la colección
    // completa. Además cacheamos por 60s para no repetir en cada filtrado.
    let counts = null;
    if (includeCounts) {
      const now = Date.now();
      if (_countsCache.counts && (now - _countsCache.at) < COUNTS_TTL_MS) {
        counts = _countsCache.counts;
      } else {
        const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
        const acc = {
          total: 0,
          pre_alerta_no_recibido: 0,
          recibido: 0,
          consolidado: 0,
          en_transito: 0,
          entregado: 0,
          stale: 0,
        };
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
              if (p.created_date && p.created_date <= sevenDaysAgo) acc.stale++;
            }
          }
          if (batch.length < B) break;
          s += B;
          if (s > 50000) break; // safety cap
        }
        counts = acc;
        _countsCache = { at: now, counts };
      }
    }

    return Response.json({ data, total, skip: pageSkip, limit: pageLimit, hasMore, counts });
  } catch (error) {
    console.error('listPackagesForSupport error:', error);
    return Response.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
});