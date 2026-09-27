import { createClientFromRequest } from 'npm:@base44/sdk@0.8.51';
import { fetchAllFilter, errorMessage, BATCH } from '../../shared/paginatedFetch.ts';

// Corrección de una sola pasada: escribe la fecha REAL de reconocimiento en el
// almacén de Venezuela (ve_recognized_date / ve_recognized_by) en los bultos que
// sí tienen registro real de escaneo: la asignación del N° de orden desde la
// pantalla de escaneo (order_assigned_date / order_assigned_by).
//
// Idempotente: no vuelve a tocar bultos que ya tienen ve_recognized_date y NO
// inventa fechas para los bultos sin escaneo (esos se muestran en la app como
// fecha de registro aproximada, y el campo queda vacío para no falsificar el
// dato que alimenta los avisos al cliente).
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const svc = base44.asServiceRole.entities;
    const bultos = await fetchAllFilter(svc.Bulto, {}, '-created_date');

    const conEscaneo = (bultos || []).filter((b: any) => !!b.order_assigned_date && !b.ve_recognized_date);

    let updated = 0;
    for (let i = 0; i < conEscaneo.length; i += BATCH) {
      const chunk = conEscaneo.slice(i, i + BATCH);
      const updates = chunk.map((b: any) => ({
        id: b.id,
        ve_recognized_date: b.order_assigned_date,
        ve_recognized_by: b.order_assigned_by || b.created_by || '',
      }));
      try {
        await svc.Bulto.bulkUpdate(updates);
        updated += updates.length;
      } catch (_) {
        for (const u of updates) {
          try {
            await svc.Bulto.update(u.id, {
              ve_recognized_date: u.ve_recognized_date,
              ve_recognized_by: u.ve_recognized_by,
            });
            updated++;
          } catch (_) {}
        }
      }
    }

    return Response.json({
      updated,
      with_scan: conEscaneo.length,
      already_with_date: (bultos || []).filter((b: any) => !!b.ve_recognized_date).length,
      without_scan: (bultos || []).filter((b: any) => !b.order_assigned_date && !b.ve_recognized_date).length,
      total_bultos: (bultos || []).length,
    });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}