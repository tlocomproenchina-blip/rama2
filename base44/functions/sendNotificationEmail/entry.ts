import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Backend function que envía emails y registra el log usando asServiceRole.
// Esto evita que el envío dependa de la cola/circuit breaker del navegador del cliente.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      to,
      subject,
      body: emailBody,
      from_name,
      // notificación in-app opcional
      in_app = null
    } = body || {};

    if (!to || !subject) {
      return Response.json({ error: 'Missing to/subject' }, { status: 400 });
    }

    // Resolver from_name desde AppConfig si no viene
    let resolvedFromName = from_name;
    if (!resolvedFromName) {
      try {
        const cfgs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' });
        const cfg = cfgs?.[0] || {};
        resolvedFromName = cfg.invoice_company_name || cfg.app_name || 'TLEC CARGO';
      } catch (_) {
        resolvedFromName = 'TLEC CARGO';
      }
    }

    // Kill switch: si emails_enabled === false, no enviar
    let emailsEnabled = true;
    try {
      const cfgs2 = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' });
      const cfg2 = cfgs2?.[0] || {};
      if (cfg2.emails_enabled === false) emailsEnabled = false;
    } catch (_) {}

    // Enviar email con service role (sin pasar por circuit breaker del cliente)
    let emailSent = false;
    let errorMessage = null;
    if (!emailsEnabled) {
      errorMessage = 'emails_enabled=false (kill switch global)';
      console.warn('SendEmail skipped:', errorMessage);
    } else {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to,
          subject,
          body: emailBody || '',
          from_name: resolvedFromName
        });
        emailSent = true;
      } catch (err) {
        errorMessage = err?.message || String(err);
        console.error('SendEmail failed:', errorMessage);
      }
    }

    // Log en EmailLog
    try {
      await base44.asServiceRole.entities.EmailLog.create({
        recipient_email: to,
        recipient_name: null,
        sender_email: null,
        from_name: resolvedFromName,
        subject,
        body_preview: String(emailBody || '').slice(0, 200),
        campaign_id: null,
        campaign_name: null,
        source: 'manual',
        status: emailSent ? 'sent' : 'failed',
        bounce_reason: emailSent ? null : errorMessage,
        sent_date: new Date().toISOString()
      });
    } catch (_) {}

    // Notificación in-app (opcional)
    if (in_app && in_app.user_email) {
      try {
        await base44.asServiceRole.entities.Notification.create({
          user_email: in_app.user_email,
          title: in_app.title || subject,
          message: in_app.message || emailBody || '',
          type: in_app.type || 'system',
          priority: in_app.priority || 'medium',
          reference_id: in_app.reference_id || null,
          entity_type: in_app.entity_type || 'System',
          icon: in_app.icon || 'bell',
          read: false
        });
      } catch (_) {}
    }

    return Response.json({ success: true, email_sent: emailSent, error: errorMessage });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});