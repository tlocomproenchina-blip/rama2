import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // If invoked by a user, require admin; if automation, allow
    let caller = null;
    try { caller = await base44.auth.me(); } catch (_) { caller = null; }
    if (caller && caller.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const nowMs = Date.now();
    const DAY = 24 * 60 * 60 * 1000;

    const users = await base44.asServiceRole.entities.User.filter({ deletion_requested: true });

    let reminded = 0;
    for (const u of users) {
      const reqAt = u.deletion_requested_at ? Date.parse(u.deletion_requested_at) : null;
      if (!reqAt) continue;

      const ageMs = nowMs - reqAt;
      const isDay6orMore = ageMs >= 6 * DAY;
      const notYetDay7 = ageMs < 7 * DAY;
      const notReminded = !u.deletion_reminder_sent_at;

      if (isDay6orMore && notYetDay7 && notReminded) {
        // Send email using template if available
        try {
          const days = Math.floor(ageMs / DAY);
          const tmpl = (await base44.asServiceRole.entities.EmailTemplate.filter({ name: 'AccountDeletionReminder' }))?.[0];
          const subject = tmpl?.subject || 'Recordatorio: tu cuenta se eliminará en 24 horas';
          const raw = tmpl?.body || 'Hola {user_name},\n\nSolicitaste eliminar tu cuenta hace {days_left} días. Si no cancelas en 24 horas, tu cuenta será eliminada.\n\nPara cancelar, inicia sesión y ve a Perfil → Eliminar cuenta.';
          const body = raw
            .replace(/{user_name}/g, u.full_name || u.email)
            .replace(/{days_left}/g, String(days));
          await base44.integrations.Core.SendEmail({ to: u.email, subject, body });
        } catch (_) { /* no-op */ }

        // Mark as reminded
        await base44.asServiceRole.entities.User.update(u.id, { deletion_reminder_sent_at: new Date().toISOString() });

        // Audit
        await base44.asServiceRole.entities.DeletionAudit.create({
          user_email: u.email,
          action: 'reminder',
          performed_by: 'system',
          performed_by_role: 'system',
          at: new Date().toISOString(),
          details: { requested_at: u.deletion_requested_at }
        });

        reminded += 1;
      }
    }

    return Response.json({ success: true, reminded });
  } catch (error) {
    return Response.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
});