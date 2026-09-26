import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

// Backfill: migra bultos con status 'despachado' que NO tienen una DispatchOrder
// asociada (por intersección de tracking_numbers) al nuevo estado 'en_almacen_ve'.
// Esto corrige bultos que fueron cerrados antes de la implementación del estado intermedio
// y que en realidad están en el almacén de Venezuela, no despachados al cliente.
// Los bultos vacíos (sin package_ids) se excluyen (son etiquetas bulk pre-armadas).
// Procesa en lotes de 100 para evitar timeout.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    // 1. Listar todos los bultos con status 'despachado' que tengan package_ids
    const allBultos = await base44.asServiceRole.entities.Bulto.list('-created_date', 500);
    const candidates = (allBultos || []).filter((b: any) => {
      const hasPackages = Array.isArray(b.package_ids) && b.package_ids.length > 0;
      return b.status === 'despachado' && hasPackages;
    });

    if (candidates.length === 0) {
      return Response.json({
        updated: 0,
        skipped: 0,
        total_candidates: 0,
        has_more: false,
      });
    }

    // 2. Listar todas las DispatchOrders para verificar cuáles bultos fueron realmente despachadas
    const allOrders = await base44.asServiceRole.entities.DispatchOrder.list('-created_date', 500);

    // Construir un mapa de trackings -> DispatchOrder (solo órdenes no canceladas)
    const trackingToOrder = new Map<string, boolean>();
    for (const order of allOrders || []) {
      if (order.status === 'cancelada') continue;
      const items = Array.isArray(order.items) ? order.items : [];
      for (const item of items) {
        const tn = item.tracking_number;
        if (tn) trackingToOrder.set(tn, true);
      }
    }

    // 3. Para cada bulto candidato, verificar si tiene DispatchOrder asociada
    const updates: any[] = [];
    let skipped = 0;

    for (const b of candidates) {
      const trackings = Array.isArray(b.package_trackings) ? b.package_trackings : [];
      // Si no hay trackings, no podemos verificar — asumimos que no fue despachado
      const hasDispatchOrder = trackings.length > 0 && trackings.some((t: string) => trackingToOrder.has(t));

      if (!hasDispatchOrder) {
        updates.push({ id: b.id, status: 'en_almacen_ve' });
      } else {
        skipped++;
      }
    }

    // 4. Bulk update de los bultos que no tienen DispatchOrder
    let updated = 0;
    const updatedIds = new Set<string>();
    if (updates.length > 0) {
      try {
        await base44.asServiceRole.entities.Bulto.bulkUpdate(updates);
        updates.forEach((u) => updatedIds.add(u.id));
        updated = updates.length;
      } catch (e) {
        // Si falla el bulkUpdate, intentar uno por uno
        for (const u of updates) {
          try {
            await base44.asServiceRole.entities.Bulto.update(u.id, { status: 'en_almacen_ve' });
            updatedIds.add(u.id);
            updated++;
          } catch (_) {}
        }
      }
    }

    // 5. Revertir paquetes de los bultos migrados: estaban marcados como 'despachado'
    // por dispatchBulto, pero al pasar el bulto a 'en_almacen_ve' deben volver a
    // 'recibido' (siguen en el almacén de Venezuela). Se excluyen IDs locales
    // (offline, formato 'local_pkg_...') que no existen en el servidor.
    const migratedBultos = candidates.filter((b: any) => updatedIds.has(b.id));
    const packageIdsToRevert: string[] = [];
    for (const b of migratedBultos) {
      const pids = Array.isArray(b.package_ids) ? b.package_ids : [];
      for (const pid of pids) {
        if (pid && !String(pid).startsWith('local_')) packageIdsToRevert.push(pid);
      }
    }

    let packagesReverted = 0;
    if (packageIdsToRevert.length > 0) {
      // Recuperar solo los paquetes efectivamente despachados para no sobreescribir otros estados
      const despachados = await base44.asServiceRole.entities.Package.filter({
        status: 'despachado',
      });
      const toRevert = (despachados || []).filter((p: any) => packageIdsToRevert.includes(p.id));
      const batches: any[][] = [];
      for (let i = 0; i < toRevert.length; i += 500) {
        batches.push(toRevert.slice(i, i + 500));
      }
      for (const batch of batches) {
        try {
          await base44.asServiceRole.entities.Package.bulkUpdate(
            batch.map((p) => ({
              id: p.id,
              status: 'recibido',
              dispatched_date: null,
              dispatched_by: null,
            }))
          );
          packagesReverted += batch.length;
        } catch (_) {
          // fallback uno a uno
          for (const p of batch) {
            try {
              await base44.asServiceRole.entities.Package.update(p.id, {
                status: 'recibido',
                dispatched_date: null,
                dispatched_by: null,
              });
              packagesReverted++;
            } catch (_) {}
          }
        }
      }
    }

    return Response.json({
      updated,
      skipped,
      packages_reverted: packagesReverted,
      total_candidates: candidates.length,
      has_more: false,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}