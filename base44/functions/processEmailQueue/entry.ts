import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { sendBrevoEmail } from '../../shared/brevoEmail.ts';

// Procesa la cola EmailQueue en lotes. Se ejecuta por automatización programada.
// Usa el helper compartido sendBrevoEmail (Brevo con fallback a Core.SendEmail).
const BATCH_SIZE = 25;
const MAX_ATTEMPTS = 3;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Si viene invocada por un usuario (manual), debe ser admin. Las automatizaciones no traen usuario.
    let user = null;
    try { user = await base44.auth.me(); } catch (_) {}
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Kill switch global
    const cfgs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' });
    const cfg = cfgs?.[0] || {};
    if (cfg.emails_enabled === false) {
      return Response.json({ success: true, skipped: true, reason: 'emails_enabled=false' });
    }

    const fromNameDefault = cfg.invoice_company_name || cfg.app_name || 'TLEC CARGO';
    const now = new Date().toISOString();

    // Pendientes cuyo scheduled_at ya pasó (o sin scheduled_at)
    const pending = await base44.asServiceRole.entities.EmailQueue.filter(
      { status: 'pending' },
      '-priority',
      BATCH_SIZE
    );
    const due = (pending || []).filter((e) => !e.scheduled_at || e.scheduled_at <= now);

    let sent = 0;
    let failed = 0;

    for (const item of due) {
      let ok = false;
      let errorMessage = null;
      try {
        const result = await sendBrevoEmail(base44, {
          to: item.recipient_email,
          subject: item.subject,
          body: item.body || '',
          from_name: item.from_name || fromNameDefault
        });
        if (!result.sent) {
          throw new Error(result.error || 'Envío fallido');
        }
        ok = true;
        sent++;
      } catch (err) {
        errorMessage = err?.message || String(err);
        failed++;
      }

      const attempts = (item.attempts || 0) + 1;
      await base44.asServiceRole.entities.EmailQueue.update(item.id, {
        status: ok ? 'sent' : (attempts >= MAX_ATTEMPTS ? 'failed' : 'pending'),
        attempts,
        error_message: errorMessage,
        sent_date: ok ? new Date().toISOString() : null
      });

      // Log en EmailLog
      try {
        await base44.asServiceRole.entities.EmailLog.create({
          recipient_email: item.recipient_email,
          from_name: item.from_name || fromNameDefault,
          subject: item.subject,
          body_preview: String(item.body || '').slice(0, 200),
          campaign_id: item.campaign_id || null,
          campaign_name: item.campaign_name || null,
          source: item.source || 'queue',
          status: ok ? 'sent' : 'failed',
          bounce_reason: ok ? null : errorMessage,
          sent_date: new Date().toISOString()
        });
      } catch (_) {}
    }

    return Response.json({ success: true, processed: due.length, sent, failed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});