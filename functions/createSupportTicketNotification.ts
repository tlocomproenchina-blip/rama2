import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Automation payload
    const payload = await req.json();
    const event = payload?.event || {};
    const type = String(event?.type || '').toLowerCase(); // 'create' | 'update' | 'delete'
    const entityId = event?.entity_id;

    let ticket = payload?.data || null;

    // If payload too large or missing data, fetch the entity
    if (!ticket && entityId) {
      try {
        ticket = await base44.asServiceRole.entities.SupportTicket.get(entityId);
      } catch (_) {
        // ignore, will guard below
      }
    }

    if (!ticket || type === 'delete') {
      return Response.json({ ok: true, skipped: true });
    }

    const ticketId = ticket.id || entityId;
    const clientEmail = ticket.client_email;
    const subject = ticket.subject || 'Ticket de soporte';

    // Helper: create a notification
    const createNotif = async ({ user_email, title, message, icon = 'alert' }) => {
      if (!user_email) return;

      // de-dup within ~10s per (user + reference + title)
      const recent = await base44.asServiceRole.entities.Notification.filter({
        user_email,
        reference_id: String(ticketId || ''),
        title,
      }, '-created_date', 1);
      if (Array.isArray(recent) && recent[0]) {
        const diff = Date.now() - new Date(recent[0].created_date).getTime();
        if (diff < 10_000) return; // skip duplicate burst
      }

      await base44.asServiceRole.entities.Notification.create({
        user_email,
        title,
        message,
        type: 'system',
        icon,
        reference_id: String(ticketId || ''),
        entity_type: 'System'
      });
    };

    if (type === 'create') {
      // Notify the client a ticket was created for them
      await createNotif({
        user_email: clientEmail,
        title: 'Nuevo Ticket de Soporte',
        message: subject,
        icon: 'alert'
      });

      return Response.json({ ok: true, created_for: clientEmail, event: type });
    }

    if (type === 'update') {
      // On update, notify client only when last message is from admin
      const messages = Array.isArray(ticket.messages) ? ticket.messages : [];
      const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;

      if (lastMsg && lastMsg.is_admin === true) {
        await createNotif({
          user_email: clientEmail,
          title: 'Nuevo mensaje de soporte',
          message: subject,
          icon: 'alert'
        });
      }

      return Response.json({ ok: true, updated: true, notified_client: !!(lastMsg && lastMsg.is_admin === true) });
    }

    return Response.json({ ok: true, no_op: true });
  } catch (error) {
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
});