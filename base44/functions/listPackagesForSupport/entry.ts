import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Lista paquetes para AdminPackages con paginación y filtros.
// Los conteos globales se mantienen incrementalmente vía la entidad PackageCounts
// (workflow "Conteos de Paquetes - Incremental" + recuento nocturno).
// Esta función ya NO escanea ni devuelve conteos — solo la lista paginada.
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

    // created_date es un campo built-in que NO soporta $gte/$lte en el SDK.
    // Cuando hay filtro de fechas, hay que fetch en lotes iterativos y filtrar en JS.
    const hasDateFilter = advancedFilters && (advancedFilters.dateFrom || advancedFilters.dateTo);

    let data;
    let hasMore;

    if (hasDateFilter) {
      const fromTime = advancedFilters.dateFrom ? new Date(advancedFilters.dateFrom + 'T00:00:00').getTime() : 0;
      const toTime = advancedFilters.dateTo ? new Date(advancedFilters.dateTo + 'T23:59:59').getTime() : Infinity;

      // Fetch iterativo: los resultados vienen ordenados por -created_date (más nuevos primero).
      // Acumulamos los que caen dentro del rango hasta tener suficientes para la página solicitada.
      let allFiltered = [];
      let batchSkip = 0;
      const batchSize = 500;
      const targetCount = pageSkip + pageLimit + 1; // +1 para detectar hasMore

      while (allFiltered.length < targetCount && batchSkip < 10000) {
        const batch = await base44.asServiceRole.entities.Package.filter(finalQuery, '-created_date', batchSize, batchSkip);
        if (!batch || batch.length === 0) break;

        for (const p of batch) {
          if (!p?.created_date) continue;
          const t = new Date(p.created_date).getTime();
          if (t >= fromTime && t <= toTime) allFiltered.push(p);
        }

        if (batch.length < batchSize) break; // no hay más datos

        // Optimización: si el paquete más viejo del lote ya es anterior a dateFrom, detener
        const oldest = batch[batch.length - 1];
        if (oldest?.created_date && new Date(oldest.created_date).getTime() < fromTime) break;

        batchSkip += batchSize;
      }

      hasMore = allFiltered.length > pageSkip + pageLimit;
      data = allFiltered.slice(pageSkip, pageSkip + pageLimit);
    } else {
      // Sin filtro de fechas: paginación normal (pageLimit + 1 para detectar hasMore)
      const fetchPlusOne = pageLimit + 1;
      const rawData = await base44.asServiceRole.entities.Package.filter(finalQuery, '-created_date', fetchPlusOne, pageSkip);
      hasMore = rawData.length > pageLimit;
      data = hasMore ? rawData.slice(0, pageLimit) : rawData;
    }

    // Los conteos globales ya no se calculan aquí (se mantienen vía PackageCounts).
    const total = null;

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

    return Response.json({ data, total, skip: pageSkip, limit: pageLimit, hasMore });
  } catch (error) {
    console.error('listPackagesForSupport error:', error);
    return Response.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
});