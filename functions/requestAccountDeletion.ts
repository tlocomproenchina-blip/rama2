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

    // Audit log
    await base44.asServiceRole.entities.DeletionAudit.create({
      user_email: user.email,
      action: 'request',
      performed_by: user.email,
      performed_by_role: 'user',
      reason,
      at: nowIso,
      details: { user_id: user.id }
    });

    // Email confirmation to user
    try {
      await base44.integrations.Core.SendEmail({
        to: user.email,
        subject: 'Confirmación de solicitud de eliminación de cuenta',
        body: `Hola ${user.full_name || ''},\n\nHemos recibido tu solicitud para eliminar tu cuenta. Tu cuenta se eliminará automáticamente en 7 días (${new Date(Date.now() + 7*24*60*60*1000).toLocaleDateString()}) a menos que la canceles desde tu Perfil.\n\nSi cambias de opinión, puedes cancelar la solicitud en cualquier momento antes del plazo.\n\nGracias.`,
      });
    } catch (_) { /* no-op */ }

    return Response.json({ success: true, deletion_requested_at: nowIso });
  } catch (error) {
    return Response.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
});