import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Limpieza one-time: quita el badge "disponible_entrega" de todos los
// CbmIngreso que NO tengan una orden de despacho activa (emitida o despachada).
// Esto corrige registros marcados incorrectamente por el flujo de facturación
// manual anterior, antes de que el badge se moviera a createDispatchOrder.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    // 1. Recopilar todos los receipt numbers con orden de despacho activa
    const receiptsWithOrder = new Set();
    for (const status of ['emitida', 'despachado']) {
      let skip = 0;
      let hasMore = true;
      while (hasMore) {
        const batch = await base44.asServiceRole.entities.DispatchOrder.filter(
          { status }, '-dispatched_date', 500, skip
        ).catch(() => []);
        for (const order of (batch || [])) {
          for (const item of (order.items || [])) {
            if (item.consolidation_tracking) {
              receiptsWithOrder.add(String(item.consolidation_tracking).trim());
            }
          }
        }
        hasMore = (batch || []).length === 500;
        skip += 500;
      }
    }

    // 2. Recorrer CbmIngreso paginado y limpiar los que no tengan orden
    let skip = 0;
    let hasMore = true;
    let scanned = 0;
    let unmarked = 0;
    const unmarkedSamples = [];

    while (hasMore) {
      const batch = await base44.asServiceRole.entities.CbmIngreso.filter(
        {}, '-fecha', 500, skip
      ).catch(() => []);
      const items = batch || [];

      for (const ing of items) {
        scanned++;
        if (ing.disponible_entrega !== true) continue;
        const num = ing.invoice_number ? String(ing.invoice_number).trim() : '';
        if (num && receiptsWithOrder.has(num)) continue; // tiene orden, dejarlo

        // No tiene orden: quitar el badge
        try {
          await base44.asServiceRole.entities.CbmIngreso.update(ing.id, { disponible_entrega: false });
          unmarked++;
          if (unmarkedSamples.length < 20) {
            unmarkedSamples.push({ id: ing.id, invoice_number: ing.invoice_number, client_email: ing.client_email });
          }
        } catch (_) {}
      }

      hasMore = items.length === 500;
      skip += 500;
    }

    return Response.json({
      success: true,
      scanned,
      receiptsWithOrder: receiptsWithOrder.size,
      unmarked,
      samples: unmarkedSamples
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}