import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

// Limpieza: revierte a 'recibido' todos los paquetes con status 'despachado'
// que NO tienen una DispatchOrder asociada (por intersección de tracking_number).
// Solo la herramienta de despacho (scanDispatchPackage / dispatchBulto) debe marcar
// 'despachado', y ambas crean una DispatchOrder. Los paquetes despachados sin orden
// son datos inconsistentes (creados manualmente o colgados tras un backfill).
//
// Opciones:
//   { dry_run: true } → solo reporta cuántos se revertirían, sin escribir.
//   { client_email } → limita a un cliente específico.
//
// Devuelve { reverted, total_despachados, orphan_count, has_more, sample }
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const dryRun = !!body.dry_run;
    const clientEmail = body.client_email || null;

    // 1. Listar todas las DispatchOrder no canceladas y construir el set de trackings despachados
    const allOrders = await base44.asServiceRole.entities.DispatchOrder.list('-created_date', 500);
    const dispatchedTrackings = new Set<string>();
    for (const order of allOrders || []) {
      if (order.status === 'cancelada') continue;
      const items = Array.isArray(order.items) ? order.items : [];
      for (const item of items) {
        const tn = item?.tracking_number;
        if (tn) dispatchedTrackings.add(String(tn).trim());
      }
    }

    // 2. Listar todos los paquetes despachados (paginado, hasta 2000)
    const filter: any = { status: 'despachado' };
    if (clientEmail) filter.client_email = clientEmail;
    const allPackages = await base44.asServiceRole.entities.Package.filter(filter, '-created_date', 2000);
    const despachados = allPackages || [];

    // 3. Identificar huérfanos (sin DispatchOrder para su tracking)
    const orphans = despachados.filter((p: any) => {
      const tn = p.tracking_number ? String(p.tracking_number).trim() : '';
      return tn && !dispatchedTrackings.has(tn);
    });

    if (dryRun) {
      return Response.json({
        dry_run: true,
        total_despachados: despachados.length,
        orphan_count: orphans.length,
        would_revert: orphans.length,
        sample: orphans.slice(0, 20).map((p) => ({
          id: p.id,
          tracking_number: p.tracking_number,
          client_email: p.client_email,
          shipping_mark: p.shipping_mark,
          dispatched_date: p.dispatched_date,
          dispatched_by: p.dispatched_by,
        })),
      });
    }

    // 4. Revertir en lotes de 500 (bulkUpdate)
    let reverted = 0;
    const errors: any[] = [];
    for (let i = 0; i < orphans.length; i += 500) {
      const batch = orphans.slice(i, i + 500);
      try {
        await base44.asServiceRole.entities.Package.bulkUpdate(
          batch.map((p) => ({
            id: p.id,
            status: 'recibido',
            dispatched_date: null,
            dispatched_by: null,
          }))
        );
        reverted += batch.length;
      } catch (e: any) {
        // fallback uno a uno
        for (const p of batch) {
          try {
            await base44.asServiceRole.entities.Package.update(p.id, {
              status: 'recibido',
              dispatched_date: null,
              dispatched_by: null,
            });
            reverted++;
          } catch (err: any) {
            errors.push({ id: p.id, tracking: p.tracking_number, error: err?.message });
          }
        }
      }
    }

    return Response.json({
      success: true,
      reverted,
      total_despachados: despachados.length,
      orphan_count: orphans.length,
      errors,
      has_more: despachados.length >= 2000,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}