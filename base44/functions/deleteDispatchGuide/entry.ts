import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// Elimina una guía de despacho y suelta los escaneos e impresiones de etiquetas
// que apuntaban a ella, para que no queden referencias a una guía que ya no existe
// (los bultos escaneados vuelven a ofrecerse como pendientes de guía).
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

    const { guide_id } = await req.json().catch(() => ({}));
    if (!guide_id) return Response.json({ error: 'Falta guide_id' }, { status: 400 });

    const db = base44.asServiceRole.entities;
    const guide = await db.DispatchGuide.get(guide_id).catch((e: any) => (e.status === 404 ? null : Promise.reject(e)));
    if (!guide) return Response.json({ error: 'La guía no existe' }, { status: 404 });

    const [scans, prints] = await Promise.all([
      unlinkAll(db.DispatchScanLog, guide_id),
      unlinkAll(db.LabelPrintLog, guide_id),
    ]);
    await db.DispatchGuide.delete(guide_id);

    console.log(`Guía ${guide.guide_number} eliminada por ${user.email}. Escaneos liberados: ${scans}, impresiones: ${prints}`);
    return Response.json({ ok: true, guide_number: guide.guide_number, scans_unlinked: scans, prints_unlinked: prints });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}