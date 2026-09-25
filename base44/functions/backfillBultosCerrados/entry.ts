import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

// Migración one-off: marca como 'cerrado' todos los Bultos con status 'activo'
// que ya tienen print_count > 0 (fueron impresos/impack) o que ya fueron despachados
// (para alinear el histórico con la realidad y que no aparezcan como abiertos).
//
// Recibe opcionalmente { dry_run: true } para solo reportar cuántos se marcarían.
// Devuelve { updated: number, already_ok: number, details: [...] }
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const dryRun = !!body.dry_run;
    const forceAll = !!body.force_all;

    // Traer todos los bultos activos (paginación simple, límite alto)
    const all = await base44.asServiceRole.entities.Bulto.filter({ status: 'activo' }, '-created_date', 2000);
    const activos = all || [];

    // Criterio por defecto: print_count > 0  → ya fue impreso → cerrado.
    // Con force_all: marca TODOS los activos como cerrado (uso manual cuando el
    // operador sabe que ya están sellados pero no tienen impresión registrada).
    const toUpdate = forceAll ? activos : activos.filter((b) => (b.print_count || 0) > 0);
    const alreadyOk = forceAll ? [] : activos.filter((b) => (b.print_count || 0) === 0);

    if (dryRun) {
      return Response.json({
        dry_run: true,
        would_update: toUpdate.length,
        already_ok: alreadyOk.length,
        sample: toUpdate.slice(0, 10).map((b) => ({ id: b.id, label_code: b.label_code, print_count: b.print_count })),
      });
    }

    // bulkUpdate con status 'cerrado'
    let updatedCount = 0;
    const errors: any[] = [];
    if (toUpdate.length) {
      try {
        await base44.asServiceRole.entities.Bulto.bulkUpdate(
          toUpdate.map((b) => ({ id: b.id, status: 'cerrado' }))
        );
        updatedCount = toUpdate.length;
      } catch (e: any) {
        // Fallback: actualizar uno a uno
        for (const b of toUpdate) {
          try {
            await base44.asServiceRole.entities.Bulto.update(b.id, { status: 'cerrado' });
            updatedCount++;
          } catch (err: any) {
            errors.push({ id: b.id, label_code: b.label_code, error: err?.message });
          }
        }
      }
    }

    return Response.json({
      success: true,
      updated: updatedCount,
      already_ok: alreadyOk.length,
      errors,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}