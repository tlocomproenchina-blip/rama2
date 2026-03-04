import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let payload = {};
    try { payload = await req.json(); } catch { payload = {}; }
    const reason = typeof payload?.reason === 'string' ? String(payload.reason).slice(0, 1000) : '';

    if (user.deletion_requested) {
      return Response.json({ success: true, already_requested: true, deletion_requested_at: user.deletion_requested_at || null });
    }

    const nowIso = new Date().toISOString();
    await base44.auth.updateMe({
      deletion_requested: true,
      deletion_requested_at: nowIso,
      deletion_reason: reason || null,
    });

    return Response.json({ success: true, deletion_requested_at: nowIso });
  } catch (error) {
    return Response.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
});