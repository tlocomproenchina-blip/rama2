import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Revoca la aprobación de ConsolidationRequest
// Uso (frontend):
// const res = await base44.functions.invoke('revokeConsolidationApproval', { request_id: 'cr_123' })
// o
// const res = await base44.functions.invoke('revokeConsolidationApproval', { request_ids: ['cr_1','cr_2'], reason: 'Corrección' })
//
// Reglas:
// - Solo ADMIN puede ejecutar
// - Solo aplica a solicitudes con status = 'aprobada'
// - Cambia status -> 'pendiente', limpia approved_by/approved_date y añade nota con auditoría

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user?.role !== 'admin') return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const reason = (body?.reason && String(body.reason).trim()) || '';

    let ids = [];
    if (body?.request_id) ids = [String(body.request_id)];
    if (Array.isArray(body?.request_ids)) ids = [...ids, ...body.request_ids.map(String)];
    ids = Array.from(new Set(ids.filter(Boolean)));

    if (!ids.length) {
      return Response.json({ success: false, error: 'Parámetros inválidos: incluye request_id o request_ids' }, { status: 400 });
    }

    const results = [];

    await Promise.all(ids.map(async (id) => {
      try {
        const cr = await base44.asServiceRole.entities.ConsolidationRequest.get(id);
        if (!cr) {
          results.push({ id, status: 'error', message: 'No existe' });
          return;
        }

        if (cr.status !== 'aprobada') {
          results.push({ id, status: 'skipped', message: `Estado actual '${cr.status}'` });
          return;
        }

        const noteLine = `Aprobación revocada por ${user.email} el ${new Date().toISOString()}${reason ? ` — ${reason}` : ''}`;
        const newNotes = cr.notes ? `${cr.notes}\n${noteLine}` : noteLine;

        await base44.asServiceRole.entities.ConsolidationRequest.update(id, {
          status: 'pendiente',
          approved_by: null,
          approved_date: null,
          notes: newNotes
        });

        results.push({ id, status: 'reverted' });
      } catch (e) {
        results.push({ id, status: 'error', message: String(e?.message || e) });
      }
    }));

    const summary = {
      reverted: results.filter(r => r.status === 'reverted').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      errors: results.filter(r => r.status === 'error').length,
      total: results.length
    };

    return Response.json({ success: true, summary, results });
  } catch (error) {
    return Response.json({ success: false, error: String(error?.message || error) }, { status: 500 });
  }
});