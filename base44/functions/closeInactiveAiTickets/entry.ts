import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // No user session needed — workflow invocation uses service role
    const now = new Date();
    const nowIso = now.toISOString();

    // Find tickets with auto_close_scheduled <= now and status in ['abierto', 'en_proceso']
    // We can't filter by auto_close_scheduled <= now directly, so we fetch tickets with
    // auto_close_scheduled exists and filter in code.
    const tickets = await base44.asServiceRole.entities.SupportTicket
      .filter({ status: { $in: ['abierto', 'en_proceso'] } }, '-created_date', 500)
      .catch(() => []);

    const dueTickets = (tickets || []).filter((t: any) => {
      if (!t.auto_close_scheduled) return false;
      if (t.ai_escalated) return false;
      return new Date(t.auto_close_scheduled) <= now;
    });

    let closedCount = 0;

    for (const ticket of dueTickets) {
      const messages = ticket.messages || [];
      if (messages.length === 0) continue;

      // Verify the last message is from AI (not from client after the AI response)
      const lastMsg = messages[messages.length - 1];
      if (!lastMsg.is_ai && !lastMsg.is_admin) {
        // Client sent a message after the AI — skip, don't close
        continue;
      }

      // Close the ticket with a system message
      const systemMsg = {
        sender_email: 'system@tlec-cargo.local',
        sender_name: 'Sistema',
        message: 'Este ticket se cerró automáticamente tras 24 horas sin respuesta. Si necesitas ayuda, abre un nuevo ticket y estaremos encantados de atenderte.',
        timestamp: nowIso,
        is_admin: false,
        is_ai: false,
        is_system: true,
        attachments: []
      };

      const updatedMessages = [...messages, systemMsg];

      await base44.asServiceRole.entities.SupportTicket.update(ticket.id, {
        messages: updatedMessages,
        status: 'cerrado',
        auto_close_scheduled: null,
        ai_feedback_buttons_shown: false,
        auto_closed: true
      }).catch(() => {});

      closedCount++;
    }

    return Response.json({
      action: 'close_inactive',
      closed: closedCount,
      checked: dueTickets.length
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}