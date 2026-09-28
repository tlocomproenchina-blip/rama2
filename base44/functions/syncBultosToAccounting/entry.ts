import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { fetchAllFilter } from '../../shared/paginatedFetch.ts';
import { syncBultoToAccounting } from '../../shared/veAccountingSync.ts';

// Corrida de conciliación: alinea los recibos de contabilidad (Ingresos de CBM) con lo
// que ya quedó registrado por el almacén de Venezuela en los bultos (N° de orden, CBM y
// conteo de paquetes). Solo admin. Procesa por lotes para no expirar y reporta cuántos
// recibos se actualizaron, cuántos se crearon y cuántos quedaron sin coincidencia.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(100, Math.max(5, Number(body.batch_size) || 25));
    const offset = Math.max(0, Number(body.offset) || 0);

    const all = await fetchAllFilter(base44.asServiceRole.entities.Bulto, {}, '-created_date');
    // Solo los bultos que ya pasaron por el almacén de Venezuela.
    const candidates = (all || []).filter((b: any) => {
      const hasOrders = Array.isArray(b.cbm_order_numbers) && b.cbm_order_numbers.filter(Boolean).length > 0;
      return hasOrders || !!b.ve_recognized_date;
    });

    const batch = candidates.slice(offset, offset + batchSize);
    const report = { updated: 0, created: 0, matched: 0, without_match: 0, total: batch.length };
    const warnings: string[] = [];

    for (const bulto of batch) {
      const result: any = await syncBultoToAccounting(base44, bulto, { actor: user.email })
        .catch(() => ({ action: 'skipped', warnings: [] }));
      if (result.action === 'updated') report.updated++;
      else if (result.action === 'created') report.created++;
      else if (result.action === 'matched') report.matched++;
      else report.without_match++;
      for (const w of result.warnings || []) {
        if (warnings.length < 20) warnings.push(`${bulto.label_code || bulto.id}: ${w}`);
      }
    }

    const nextOffset = offset + batchSize;
    const hasMore = nextOffset < candidates.length;
    return Response.json({
      ...report,
      warnings,
      candidates: candidates.length,
      has_more: hasMore,
      next_offset: hasMore ? nextOffset : 0,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}