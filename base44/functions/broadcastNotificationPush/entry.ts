import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const ENTITY_URL_MAP = {
  Package: '/MyPackages',
  Consolidation: '/MyConsolidations',
  ConsolidationRequest: '/RequestConsolidation',
  Invoice: '/MyInvoices',
  AssistedPaymentRequest: '/AssistedPayment',
  System: '/'
};

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const payload = await req.json();
  const data = payload?.data;

  // Sin datos → salir
  if (!data || !data.id) {
    return Response.json({ success: true, skipped: true, reason: 'No notification data' });
  }

  // Excluir notificaciones de tipo system (ruido administrativo interno)
  if (data.type === 'system') {
    return Response.json({ success: true, skipped: true, reason: 'System notification ignored' });
  }

  // Evitar duplicar push que ya envía notifyPackageStatusPush
  if (data.type === 'package' && data.entity_type === 'Package') {
    return Response.json({ success: true, skipped: true, reason: 'Package push already handled by notifyPackageStatusPush' });
  }

  try {
    // La notificación SOLO debe llegar al dueño (user_email del registro Notification).
    // Antes se enviaba a todos los usuarios suscritos → bug de privacidad.
    if (!data.user_email) {
      await base44.asServiceRole.entities.Notification.update(data.id, {
        push_broadcast_sent: false,
        push_recipient_count: 0
      });
      return Response.json({ success: true, skipped: true, reason: 'Notification has no user_email', recipient_count: 0 });
    }

    const targetUsers = await base44.asServiceRole.entities.User.filter({ email: data.user_email });
    const subscribedUsers = targetUsers.filter(u => u.push_subscription);

    if (subscribedUsers.length === 0) {
      // Marcar el registro para que el admin vea que nadie recibió el push
      await base44.asServiceRole.entities.Notification.update(data.id, {
        push_broadcast_sent: false,
        push_recipient_count: 0
      });
      return Response.json({ success: true, skipped: true, reason: 'Owner has no push subscription', recipient_count: 0 });
    }

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!vapidPublicKey || !vapidPrivateKey) {
      return Response.json({ error: 'VAPID keys not configured' }, { status: 500 });
    }

    // Obtener el logo de la app desde AppConfig para usarlo como badge
    let badgeUrl = '';
    try {
      const configs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1);
      badgeUrl = configs?.[0]?.app_logo_url || '';
    } catch (_) {}

    const webpush = await import('npm:web-push@3.6.7');
    webpush.default.setVapidDetails(
      'mailto:admin@tleclogistics.com',
      vapidPublicKey,
      vapidPrivateKey
    );

    const targetUrl = ENTITY_URL_MAP[data.entity_type] || '/';
    const pushPayload = JSON.stringify({
      title: data.title,
      body: data.message,
      url: targetUrl,
      ...(badgeUrl ? { badge: badgeUrl } : {}),
      tag: `notif-${data.id}`
    });

    let successCount = 0;
    const failedUserIds = [];

    // Enviar a cada suscripción en paralelo, limpiando las que fallen con 404/410
    const sendPromises = subscribedUsers.map(async (user) => {
      try {
        await webpush.default.sendNotification(user.push_subscription, pushPayload);
        successCount++;
      } catch (pushError) {
        const status = pushError.statusCode;
        if (status === 404 || status === 410) {
          // Suscripción expirada: limpiarla y continuar
          failedUserIds.push(user.id);
        } else {
          console.error(`Push failed for ${user.email}:`, status, pushError.body || pushError.message);
        }
      }
    });

    await Promise.all(sendPromises);

    // Limpiar suscripciones expiradas en paralelo (best-effort)
    if (failedUserIds.length > 0) {
      await Promise.all(
        failedUserIds.map(id =>
          base44.asServiceRole.entities.User.update(id, { push_subscription: null }).catch(() => {})
        )
      );
    }

    // Marcar el registro Notification con el resultado del broadcast
    await base44.asServiceRole.entities.Notification.update(data.id, {
      push_broadcast_sent: successCount > 0,
      push_recipient_count: successCount
    });

    return Response.json({
      success: true,
      recipient_count: successCount,
      cleaned_subscriptions: failedUserIds.length
    });
  } catch (error) {
    console.error('broadcastNotificationPush error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});