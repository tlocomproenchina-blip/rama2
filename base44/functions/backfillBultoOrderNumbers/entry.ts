import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

// Backfill de cbm_order_numbers en bultos existentes.
// Lista bultos con package_trackings no vacíos y sin cbm_order_numbers,
// busca CbmIngreso cuyos tracking_numbers intersecten con los package_trackings del bulto,
// y actualiza el bulto con los invoice_numbers encontrados.
// Procesa en lotes de 50 para evitar timeout.
// Retorna: { updated, no_match, without_trackings, total_processed, has_more }
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(100, Math.max(10, Number(body.batch_size) || 50));
    const offset = Math.max(0, Number(body.offset) || 0);

    // 1. Listar bultos con package_trackings no vacíos y sin cbm_order_numbers
    // Usamos filter con sort por created_date descendente para priorizar los más recientes.
    const allBultos = await base44.asServiceRole.entities.Bulto.list('-created_date', 500);
    const candidates = (allBultos || []).filter((b: any) => {
      const hasTrackings = Array.isArray(b.package_trackings) && b.package_trackings.length > 0;
      const hasOrders = Array.isArray(b.cbm_order_numbers) && b.cbm_order_numbers.length > 0;
      return hasTrackings && !hasOrders;
    });

    if (candidates.length === 0) {
      return Response.json({
        updated: 0,
        no_match: 0,
        without_trackings: 0,
        total_processed: 0,
        has_more: false,
        total_candidates: 0,
      });
    }

    // Contar bultos sin trackings para reporte
    const withoutTrackings = (allBultos || []).filter((b: any) => {
      const hasTrackings = Array.isArray(b.package_trackings) && b.package_trackings.length > 0;
      const hasOrders = Array.isArray(b.cbm_order_numbers) && b.cbm_order_numbers.length > 0;
      return !hasTrackings && !hasOrders;
    }).length;

    // 2. Procesar el lote actual
    const batch = candidates.slice(offset, offset + batchSize);
    if (batch.length === 0) {
      return Response.json({
        updated: 0,
        no_match: 0,
        without_trackings: withoutTrackings,
        total_processed: 0,
        has_more: false,
        total_candidates: candidates.length,
      });
    }

    // 3. Recolectar todos los trackings únicos del lote
    const allTrackings = new Set<string>();
    for (const b of batch) {
      for (const t of b.package_trackings || []) {
        if (t) allTrackings.add(t);
      }
    }

    // 4. Buscar CbmIngreso que contengan alguno de esos trackings.
    // CbmIngreso.tracking_numbers es un array; filtramos por cliente para reducir el conjunto.
    // Agrupamos bultos por client_email para hacer queries por cliente.
    const byClient = new Map<string, any[]>();
    for (const b of batch) {
      const email = b.client_email || '';
      if (!byClient.has(email)) byClient.set(email, []);
      byClient.get(email)!.push(b);
    }

    // Para cada cliente, buscar sus CbmIngreso con tracking_numbers no vacíos
    const cbmByClient = new Map<string, any[]>();
    for (const [email] of byClient) {
      try {
        const cbms = await base44.asServiceRole.entities.CbmIngreso.filter(
          { client_email: email }, '-fecha', 200
        );
        // Filtrar solo los que tienen tracking_numbers con al menos un match
        const relevant = (cbms || []).filter((c: any) => {
          const tn = Array.isArray(c.tracking_numbers) ? c.tracking_numbers : [];
          return tn.some((t: string) => allTrackings.has(t));
        });
        cbmByClient.set(email, relevant);
      } catch (_) {
        cbmByClient.set(email, []);
      }
    }

    // 5. Para cada bulto, encontrar los invoice_numbers cuyos tracking_numbers intersecten
    const updates: any[] = [];
    let updated = 0;
    let noMatch = 0;

    for (const b of batch) {
      const cbms = cbmByClient.get(b.client_email) || [];
      const bultoTrackings = new Set(b.package_trackings || []);
      const orderNumbers = new Set<string>();

      for (const c of cbms) {
        const tn = Array.isArray(c.tracking_numbers) ? c.tracking_numbers : [];
        const hasIntersection = tn.some((t: string) => bultoTrackings.has(t));
        if (hasIntersection && c.invoice_number) {
          orderNumbers.add(c.invoice_number);
        }
      }

      if (orderNumbers.size > 0) {
        updates.push({
          id: b.id,
          cbm_order_numbers: Array.from(orderNumbers),
        });
        updated++;
      } else {
        noMatch++;
      }
    }

    // 6. Bulk update de los bultos que tuvieron match
    if (updates.length > 0) {
      try {
        await base44.asServiceRole.entities.Bulto.bulkUpdate(updates);
      } catch (e) {
        // Si falla el bulkUpdate, intentar uno por uno
        for (const u of updates) {
          try {
            await base44.asServiceRole.entities.Bulto.update(u.id, { cbm_order_numbers: u.cbm_order_numbers });
          } catch (_) {}
        }
      }
    }

    const nextOffset = offset + batchSize;
    const hasMore = nextOffset < candidates.length;

    return Response.json({
      updated,
      no_match: noMatch,
      without_trackings: withoutTrackings,
      total_processed: batch.length,
      has_more: hasMore,
      total_candidates: candidates.length,
      next_offset: hasMore ? nextOffset : 0,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}