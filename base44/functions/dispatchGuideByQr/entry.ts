import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { markGuideDispatched } from '../../shared/guideDispatchDue.ts';

// Despacha todas las unidades de una guía al escanear el QR impreso en su PDF.
// Solo toca los bultos y cajas que la guía tiene registrados. Es idempotente.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const raw = String(body?.code || '').trim();
    const match = raw.match(/^GUIA:([A-Z0-9-]{1,40})$/i);
    if (!match) return Response.json({ error: 'El código no es un QR de guía válido.' }, { status: 400 });
    const guideNumber = match[1].toUpperCase();

    const svc = base44.asServiceRole.entities;
    const [guide] = await svc.DispatchGuide.filter({ guide_number: guideNumber }, '-emitted_date', 1);
    if (!guide) return Response.json({ error: `No existe la guía ${guideNumber}.` }, { status: 404 });

    const codes = [...new Set((guide.bulto_codes || []).map((c: any) => String(c || '').trim().toUpperCase()).filter(Boolean))];
    const found: any[] = [];
    for (let i = 0; i < codes.length; i += 100) {
      const rows = await svc.Bulto.filter({ label_code: { $in: codes.slice(i, i + 100) } }, '-created_date', 100);
      found.push(...rows);
    }
    const foundCodes = new Set(found.map((b: any) => String(b.label_code).toUpperCase()));
    const alreadyDispatched = found.filter((b: any) => b.status === 'despachado').length;
    const missing = codes.filter((c) => !foundCodes.has(c));

    const result = await markGuideDispatched(base44, guide);
    const now = new Date().toISOString();
    await svc.DispatchGuide.update(guide.id, {
      dispatch_due_completed_date: guide.dispatch_due_completed_date || now,
      last_updated_date: now,
      last_updated_by: user.email,
    });

    return Response.json({
      success: true,
      guide_number: guide.guide_number,
      clients: (guide.client_names || []).length,
      total_units: codes.length,
      dispatched: result.bultos,
      already_dispatched: alreadyDispatched,
      containers: result.containers,
      missing,
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Error' }, { status: 500 });
  }
}