import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await base44.auth.updateMe({
      deletion_requested: false,
      deletion_requested_at: null,
      deletion_reason: null,
      deletion_reminder_sent_at: null,
    });

    // Audit log
    const nowIso = new Date().toISOString();
    await base44.asServiceRole.entities.DeletionAudit.create({
      user_email: user.email,
      action: 'cancel',
      performed_by: user.email,
      performed_by_role: 'user',
      at: nowIso,
      details: { user_id: user.id }
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
});