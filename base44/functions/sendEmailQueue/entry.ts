import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Encola mensajes de campañas en EmailQueue.
// El envío real lo hace processEmailQueue (automatización cada 15 min),
// único punto del sistema que llama a Core.SendEmail.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: 'messages requerido' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const records = messages
      .filter((m) => m?.to && m?.subject)
      .map((m) => ({
        recipient_email: m.to,
        subject: m.subject,
        body: m.body || '',
        from_name: m.from_name || undefined,
        status: 'pending',
        attempts: 0,
        scheduled_at: now,
        source: m.source || 'campaign',
        provider: m.provider === 'base44' ? 'base44' : 'brevo',
        campaign_id: m.campaign_id || undefined,
        campaign_name: m.campaign_name || undefined
      }));

    if (records.length === 0) {
      return Response.json({ error: 'Ningún mensaje válido' }, { status: 400 });
    }

    await base44.asServiceRole.entities.EmailQueue.bulkCreate(records);

    return Response.json({ success: true, queued: records.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});