import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const data = payload?.data;

    if (!data?.user_email || !data?.title) {
      return Response.json({ success: true, skipped: true, reason: 'Missing notification data' });
    }

    // Solo enviar push a administradores (los clientes ya tienen su propio push de paquetes)
    const users = await base44.asServiceRole.entities.User.filter({ email: data.user_email });
    const user = users[0];
    if (!user || user.role !== 'admin') {
      return Response.json({ success: true, skipped: true, reason: 'Not an admin' });
    }
    if (!user.push_subscription) {
      return Response.json({ success: true, skipped: true, reason: 'No push subscription' });
    }

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    if (!vapidPublicKey || !vapidPrivateKey) {
      return Response.json({ error: 'VAPID keys not configured' }, { status: 500 });
    }

    const webpush = await import('npm:web-push@3.6.7');
    webpush.default.setVapidDetails(
      'mailto:admin@tleclogistics.com',
      vapidPublicKey,
      vapidPrivateKey
    );

    const pushPayload = JSON.stringify({
      title: data.title,
      body: data.message || '',
      url: '/AccountingDashboard',
      icon: 'https://media.base44.com/images/public/695da428c9924ef9b68e8866/a3f02ea86_generated_image.png',
      tag: `admin-notification-${data.id || Date.now()}`
    });

    try {
      await webpush.default.sendNotification(user.push_subscription, pushPayload);
    } catch (pushError) {
      // Suscripción expirada o inválida — no fallar la automatización
      console.error('Push send failed:', pushError.message);
      return Response.json({ success: true, skipped: true, reason: 'Push send failed' });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('notifyAdminNotificationPush error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});