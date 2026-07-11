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

    // Encolar el email en EmailQueue (no envía de inmediato).
    // La función programada processEmailQueue procesa la cola en lotes.
    let queued = false;
    let errorMessage = null;
    if (!emailsEnabled) {
      errorMessage = 'emails_enabled=false (kill switch global)';
      console.warn('Email no encolado:', errorMessage);
    } else {
      try {
        await base44.asServiceRole.entities.EmailQueue.create({
          recipient_email: to,
          subject,
          body: emailBody || '',
          from_name: resolvedFromName,
          status: 'pending',
          attempts: 0,
          scheduled_at: new Date().toISOString(),
          source: 'notification',
          priority: 1
        });
        queued = true;
      } catch (err) {
        errorMessage = err?.message || String(err);
        console.error('Encolado de email falló:', errorMessage);
      }
    }

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

      // Push directo al destinatario (sin automatización) — mejor esfuerzo
      try {
        const targetUsers = await base44.asServiceRole.entities.User.filter({ email: in_app.user_email });
        const pushSub = targetUsers[0]?.push_subscription;
        const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
        const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
        if (pushSub && vapidPublicKey && vapidPrivateKey) {
          const webpush = await import('npm:web-push@3.6.7');
          webpush.default.setVapidDetails('mailto:admin@tleclogistics.com', vapidPublicKey, vapidPrivateKey);
          await webpush.default.sendNotification(pushSub, JSON.stringify({
            title: in_app.title || subject,
            body: in_app.message || emailBody || '',
            url: '/',
            icon: '/icon-192x192.png',
            tag: `notification-${Date.now()}`
          }));
        }
      } catch (pushErr) {
        console.warn('Push send failed:', pushErr?.message || pushErr);
      }
    }

    return Response.json({ success: true, email_sent: queued, queued, error: errorMessage });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});