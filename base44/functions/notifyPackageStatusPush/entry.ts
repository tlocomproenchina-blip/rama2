import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const data = payload?.data;
    const oldData = payload?.old_data;
    const changedFields = payload?.changed_fields || [];

    if (!data?.client_email || !data?.tracking_number) {
      return Response.json({ success: true, skipped: true, reason: 'Missing package data' });
    }

    if (!changedFields.includes('status')) {
      return Response.json({ success: true, skipped: true, reason: 'Status did not change' });
    }

    if (!['recibido', 'consolidado'].includes(data.status)) {
      return Response.json({ success: true, skipped: true, reason: 'Status not eligible' });
    }

    if (oldData?.status === data.status) {
      return Response.json({ success: true, skipped: true, reason: 'Same status' });
    }

    const users = await base44.asServiceRole.entities.User.filter({ email: data.client_email });
    if (!users.length || !users[0].push_subscription) {
      return Response.json({ success: true, skipped: true, reason: 'No push subscription found' });
    }

    const subscription = users[0].push_subscription;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!vapidPublicKey || !vapidPrivateKey) {
      return Response.json({ error: 'VAPID keys not configured' }, { status: 500 });
    }

    const title = data.status === 'recibido'
      ? '📦 Paquete recibido'
      : '📦 Paquete consolidado';

    const body = data.status === 'recibido'
      ? `Tu paquete ${data.tracking_number} ya fue recibido en almacén.`
      : `Tu paquete ${data.tracking_number} fue consolidado exitosamente.`;

    const webpush = await import('npm:web-push@3.6.7');
    webpush.default.setVapidDetails(
      'mailto:admin@tleclogistics.com',
      vapidPublicKey,
      vapidPrivateKey
    );

    const pushPayload = JSON.stringify({
      title,
      body,
      url: '/MyPackages',
      icon: 'https://media.base44.com/images/public/695da428c9924ef9b68e8866/a3f02ea86_generated_image.png',
      tag: `package-status-${data.id || data.tracking_number}-${data.status}`
    });

    await webpush.default.sendNotification(subscription, pushPayload);

    return Response.json({ success: true });
  } catch (error) {
    console.error('notifyPackageStatusPush error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});