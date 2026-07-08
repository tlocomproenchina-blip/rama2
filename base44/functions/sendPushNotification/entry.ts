import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const { userEmail, title, body, url } = await req.json();

    if (!userEmail || !title) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Obtener usuario con suscripción
    const users = await base44.asServiceRole.entities.User.filter({ email: userEmail });
    if (users.length === 0 || !users[0].push_subscription) {
      return Response.json({ error: 'No push subscription found' }, { status: 404 });
    }

    const subscription = users[0].push_subscription;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!vapidPublicKey || !vapidPrivateKey) {
      return Response.json({ error: 'VAPID keys not configured' }, { status: 500 });
    }

    // Importar web-push
    const webpush = await import('npm:web-push@3.6.7');
    
    webpush.default.setVapidDetails(
      'mailto:admin@tleclogistics.com',
      vapidPublicKey,
      vapidPrivateKey
    );

    const payload = JSON.stringify({
      title,
      body,
      url: url || '/',
      icon: 'https://media.base44.com/images/public/695da428c9924ef9b68e8866/a3f02ea86_generated_image.png',
      tag: `notification-${Date.now()}`
    });

    await webpush.default.sendNotification(subscription, payload);

    return Response.json({ success: true });
  } catch (error) {
    console.error('Push notification error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});