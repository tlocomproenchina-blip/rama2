import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { processQueueItems, queueFromName } from '../../shared/emailQueueProcess.ts';

// Registra los mensajes de la campaña en EmailQueue y los envía de inmediato.
// Los que fallen quedan 'pending' y la cola programada los reintenta.
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
        // 'sending' para que la cola programada no los tome: se envían ya mismo abajo
        status: 'sending',
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

    const created = await base44.asServiceRole.entities.EmailQueue.bulkCreate(records);

    const cfgs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' });
    const { sent, failed } = await processQueueItems(base44, created || [], queueFromName(cfgs?.[0]));

    return Response.json({ success: true, queued: records.length, sent, failed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});