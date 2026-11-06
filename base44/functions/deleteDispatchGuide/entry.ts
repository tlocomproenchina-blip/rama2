import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// Elimina una o varias guías de despacho y suelta los escaneos e impresiones de
// etiquetas que apuntaban a ellas, para que no queden referencias a guías que ya
// no existen (los bultos escaneados vuelven a ofrecerse como pendientes de guía).
// Recibe: { guide_id } o { guide_ids: [] }
const UNLINK = { $unset: { guide_id: '', guide_number: '', guide_emitted_date: '' } };

async function unlinkAll(entity: any, guideId: string) {
  let total = 0;
  for (let i = 0; i < 50; i++) {
    const res: any = await entity.updateMany({ guide_id: guideId }, UNLINK);
    total += Number(res?.modified_count ?? res?.updated ?? 0);
    if (!res?.has_more) break;
  }
  return total;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e: any) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo un administrador puede eliminar guías' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body.guide_ids) && body.guide_ids.length
      ? [...new Set(body.guide_ids.filter((id: any) => typeof id === 'string' && id))] as string[]
      : (body.guide_id ? [body.guide_id] : []);
    if (!ids.length) return Response.json({ error: 'Falta guide_id' }, { status: 400 });

    const db = base44.asServiceRole.entities;
    const deleted: string[] = [];
    const failed: { id: string; error: string }[] = [];
    let scans = 0;
    let prints = 0;

    for (let i = 0; i < ids.length; i += 3) {
      const batch = ids.slice(i, i + 3);
      const results = await Promise.allSettled(batch.map(async (id) => {
        const guide = await db.DispatchGuide.get(id).catch((e: any) => (e.status === 404 ? null : Promise.reject(e)));
        if (!guide) throw new Error('La guía no existe');
        const [s, p] = await Promise.all([unlinkAll(db.DispatchScanLog, id), unlinkAll(db.LabelPrintLog, id)]);
        await db.DispatchGuide.delete(id);
        scans += s;
        prints += p;
        return guide.guide_number || id;
      }));
      results.forEach((r, idx) => {
        if (r.status === 'fulfilled') deleted.push(r.value);
        else failed.push({ id: batch[idx], error: (r.reason as Error)?.message || 'Error' });
      });
    }

    console.log(`Guías eliminadas por ${user.email}: ${deleted.join(', ')}. Fallidas: ${failed.length}`);
    if (!deleted.length) {
      return Response.json({ error: failed[0]?.error || 'No se pudo eliminar', failed }, { status: failed.every((f) => f.error === 'La guía no existe') ? 404 : 500 });
    }
    return Response.json({ ok: true, deleted, failed, scans_unlinked: scans, prints_unlinked: prints });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}