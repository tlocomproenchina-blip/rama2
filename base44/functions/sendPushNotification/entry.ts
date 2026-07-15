import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Solo usuarios autenticados pueden disparar pushes
    let caller = null;
    try { caller = await base44.auth.me(); } catch (_) {}
    if (!caller) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
      badge: 'https://base44.app/api/apps/695da428c9924ef9b68e8866/files/mp/public/695da428c9924ef9b68e8866/f98391e7a_badge-ship.png',
      tag: `notification-${Date.now()}`
    });

    try {
      await webpush.default.sendNotification(subscription, payload);
    } catch (pushError) {
      const status = pushError.statusCode;
      console.error('web-push error:', status, pushError.body || pushError.message);
      if (status === 404 || status === 410) {
        // Suscripción expirada o inválida: limpiarla para forzar re-suscripción
        await base44.asServiceRole.entities.User.update(users[0].id, { push_subscription: null });
        return Response.json({ error: 'La suscripción push expiró. Pulsa el botón de nuevo para re-suscribirte.' }, { status: 410 });
      }
      return Response.json({ error: `El servicio push rechazó el envío (${status || 'sin código'}): ${pushError.body || pushError.message}` }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Push notification error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});