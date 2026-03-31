import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Parse automation payload
    let payload = {};
    try {
      payload = await req.json();
    } catch (_) {
      payload = {};
    }

    const event = payload?.event || {};
    let ticket = payload?.data || null;

    // Only handle create events
    if (event?.type !== 'create') {
      return Response.json({ skipped: true, reason: 'Not a create event' });
    }

    // If payload is too large or missing, fetch the ticket
    if ((!ticket || payload?.payload_too_large) && event?.entity_id) {
      try {
        ticket = await base44.asServiceRole.entities.get('SupportTicket', event.entity_id);
      } catch (_) {
        // ignore and continue
      }
    }

    if (!ticket) {
      return Response.json({ error: 'Missing ticket data' }, { status: 400 });
    }

    const to = ticket.client_email;
    if (!to) {
      return Response.json({ skipped: true, reason: 'Ticket without client_email' });
    }

    const configs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' });
    const config = configs?.[0] || {};
    if (config.external_services_enabled === false) {
      return Response.json({ success: true, skipped: true, reason: config.external_services_message || 'Modo demo activo: email desactivado.' });
    }

    const subject = `Nuevo Ticket de Soporte${ticket.ticket_number ? ' - ' + ticket.ticket_number : ''}`;
    const body = [
      'Hola,',
      '',
      'Se ha creado un ticket de soporte para ti.',
      `Asunto: ${ticket.subject || 'Soporte'}`,
      `Tracking: ${ticket.related_tracking || 'N/A'}`,
      '',
      'Puedes responder desde tu panel de soporte.',
      '',
      'Gracias.',
    ].join('\n');

    await base44.integrations.Core.SendEmail({ from_name: 'TLEC CARGO', to, subject, body });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});