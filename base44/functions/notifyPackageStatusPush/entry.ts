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

    const title = data.status === 'recibido'
      ? '📦 Paquete recibido'
      : '📦 Paquete consolidado';

    const body = data.status === 'recibido'
      ? `Tu paquete ${data.tracking_number} ya fue recibido en almacén.`
      : `Tu paquete ${data.tracking_number} fue consolidado exitosamente.`;

    const functionResponse = await base44.asServiceRole.functions.invoke('sendPushNotification', {
      userEmail: data.client_email,
      title,
      body,
      url: '/MyPackages'
    });

    return Response.json({ success: true, push: functionResponse?.data || null });
  } catch (error) {
    console.error('notifyPackageStatusPush error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});