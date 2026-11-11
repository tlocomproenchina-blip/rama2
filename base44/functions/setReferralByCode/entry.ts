import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { linkReferral } from '../../shared/referralSync.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { code } = await req.json();
    const r: any = await linkReferral(base44.asServiceRole, me, code);
    if (r.error) return Response.json({ error: r.error }, { status: r.status || 400 });
    return Response.json(r);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});