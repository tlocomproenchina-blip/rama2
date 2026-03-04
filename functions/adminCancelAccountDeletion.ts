import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (caller.role !== 'admin') return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });

    let payload = {};
    try { payload = await req.json(); } catch { payload = {}; }
    const { user_id, email, reason } = payload || {};

    let target = null;
    if (user_id) {
      const users = await base44.asServiceRole.entities.User.filter({ id: user_id });
      target = users?.[0] || null;
    } else if (email) {
      const users = await base44.asServiceRole.entities.User.filter({ email });
      target = users?.[0] || null;
    }

    if (!target) return Response.json({ error: 'User not found' }, { status: 404 });

    await base44.asServiceRole.entities.User.update(target.id, {
      deletion_requested: false,
      deletion_requested_at: null,
      deletion_reason: null,
      deletion_reminder_sent_at: null,
    });

    const nowIso = new Date().toISOString();
    await base44.asServiceRole.entities.DeletionAudit.create({
      user_email: target.email,
      action: 'admin_cancel',
      performed_by: caller.email,
      performed_by_role: 'admin',
      at: nowIso,
      reason: reason || null,
      details: { admin_id: caller.id, user_id: target.id }
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
});