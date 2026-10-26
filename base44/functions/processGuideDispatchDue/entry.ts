import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import {
  isDispatchDueReached,
  markGuideDispatched,
  nextSaturdayDateKey,
} from '../../shared/guideDispatchDue.ts';

// Aplica la regla de despacho de las guías: toda guía emitida se marca despachada
// (sus bultos y los contenedores que salieron en ella) al alcanzar el sábado
// inmediato posterior a su emisión, contando ese sábado como alcanzado en hora de
// Caracas. También completa la fecha límite de las guías anteriores a la regla.
// Es idempotente: una guía ya procesada no se vuelve a tocar.
const PAGE_SIZE = 200;
const MAX_GUIDES_PER_RUN = 200;

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth
      .me()
      .catch((e: any) => (e?.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const dryRun = !!body?.dry_run;
    const now = new Date();
    const svc = base44.asServiceRole.entities;

    const guides: any[] = [];
    let cursor: string | undefined;
    do {
      const page: any = await svc.DispatchGuide.list({
        sort: '-emitted_date',
        limit: PAGE_SIZE,
        ...(cursor ? { cursor } : {}),
      });
      const items = Array.isArray(page) ? page : page?.items || [];
      guides.push(...items);
      cursor = Array.isArray(page) ? undefined : page?.next_cursor;
    } while (cursor);

    let reviewed = 0;
    let bultosMarked = 0;
    let containersMarked = 0;
    const processed: any[] = [];

    for (const guide of guides) {
      if (processed.length >= MAX_GUIDES_PER_RUN) break;
      reviewed += 1;

      // Ya procesada: solo se vuelve a mirar si la guía recibió carga nueva después.
      if (guide?.dispatch_due_completed_date) {
        const completedMs = new Date(guide.dispatch_due_completed_date).getTime() || 0;
        const touchedMs = new Date(guide.last_updated_date || 0).getTime() || 0;
        if (touchedMs <= completedMs) continue;
      }

      const storedDue = String(guide?.dispatch_due_date || '').trim();
      const due = storedDue || nextSaturdayDateKey(guide?.emitted_date);
      if (!due) continue;

      // Guías creadas antes de la regla: se les guarda su sábado límite.
      if (!storedDue && !dryRun) {
        await svc.DispatchGuide.update(guide.id, { dispatch_due_date: due }).catch(() => null);
      }

      if (!isDispatchDueReached(due, now)) continue;

      if (dryRun) {
        processed.push({ guide_number: guide.guide_number, due_date: due });
        continue;
      }

      const marked = await markGuideDispatched(base44, guide);
      bultosMarked += marked.bultos;
      containersMarked += marked.containers;

      await svc.DispatchGuide.update(guide.id, {
        dispatch_due_date: due,
        dispatch_due_completed_date: now.toISOString(),
        dispatch_due_bultos: (Number(guide.dispatch_due_bultos) || 0) + marked.bultos,
        dispatch_due_containers: (Number(guide.dispatch_due_containers) || 0) + marked.containers,
      }).catch(() => null);

      processed.push({
        guide_number: guide.guide_number,
        due_date: due,
        bultos: marked.bultos,
        containers: marked.containers,
      });
    }

    return Response.json({
      ok: true,
      dry_run: dryRun,
      guides_reviewed: reviewed,
      guides_dispatched: processed.length,
      bultos_marked: bultosMarked,
      containers_marked: containersMarked,
      processed,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}