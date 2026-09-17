import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { ticket_id, feedback } = body as { ticket_id: string; feedback: string };

    if (!ticket_id || !feedback) {
      return Response.json({ error: 'ticket_id y feedback son obligatorios' }, { status: 400 });
    }

    if (feedback !== 'positivo' && feedback !== 'negativo') {
      return Response.json({ error: 'feedback debe ser "positivo" o "negativo"' }, { status: 400 });
    }

    // Require user session
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Load ticket
    const ticket = await base44.entities.SupportTicket.get(ticket_id).catch(() => null);
    if (!ticket) {
      return Response.json({ error: 'Ticket no encontrado' }, { status: 404 });
    }

    // Verify user is the ticket owner
    if (ticket.client_email !== user.email && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Skip if ticket is already closed or resolved
    if (ticket.status === 'cerrado') {
      return Response.json({ skipped: true, reason: 'Ticket ya cerrado' });
    }

    const now = new Date().toISOString();
    const messages = ticket.messages || [];

    if (feedback === 'positivo') {
      // Mark as resolved, post thank-you message from AI
      const thankYouMsg = {
        sender_email: 'ai-assistant@tlec-cargo.local',
        sender_name: 'Asistente IA',
        message: '¡Me alegra mucho haberte ayudado! 😊 Si necesitas algo más en el futuro, no dudes en escribirnos. Estaremos siempre aquí para ti.',
        timestamp: now,
        is_admin: false,
        is_ai: true,
        is_system: false,
        attachments: []
      };

      const updatedMessages = [...messages, thankYouMsg];

      await base44.entities.SupportTicket.update(ticket_id, {
        messages: updatedMessages,
        status: 'resuelto',
        resolved_date: now,
        feedback_received: 'positivo',
        auto_close_scheduled: null,
        ai_feedback_buttons_shown: false
      });

      return Response.json({
        action: 'resolved',
        feedback: 'positivo',
        message: thankYouMsg.message
      });
    } else {
      // Negative feedback: add client message to trigger AI re-response
      const clientMsg = {
        sender_email: user.email,
        sender_name: user.full_name || user.email,
        message: 'No quedé satisfecho con la respuesta, necesito más ayuda por favor.',
        timestamp: now,
        is_admin: false,
        is_ai: false,
        is_system: false,
        attachments: []
      };

      const updatedMessages = [...messages, clientMsg];

      await base44.entities.SupportTicket.update(ticket_id, {
        messages: updatedMessages,
        status: 'en_proceso',
        feedback_received: 'negativo',
        auto_close_scheduled: null,
        ai_feedback_buttons_shown: false
      });

      // The entity trigger workflow will fire and the AI will respond automatically

      return Response.json({
        action: 're_opened',
        feedback: 'negativo',
        message: 'Se ha notificado al asistente para que te brinde más ayuda.'
      });
    }
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}