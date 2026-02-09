import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (event.type !== 'create') {
      return Response.json({ success: true });
    }

    const request = data;
    if (!request.client_email) {
      return Response.json({ success: true });
    }

    // Notificar al cliente
    await base44.asServiceRole.entities.Notification.create({
      user_email: request.client_email,
      title: '📬 Solicitud de consolidación',
      message: `Tu solicitud de consolidación ha sido recibida y está pendiente de aprobación.`,
      type: 'request',
      priority: 'medium',
      reference_id: request.id,
      entity_type: 'ConsolidationRequest',
      icon: 'info'
    });

    // Notificar a admins
    const users = await base44.asServiceRole.entities.User.list();
    const admins = users.filter(u => u.role === 'admin');

    for (const admin of admins) {
      await base44.asServiceRole.entities.Notification.create({
        user_email: admin.email,
        title: '🔔 Nueva solicitud de consolidación',
        message: `${request.client_email} solicita consolidar ${request.package_ids?.length || 0} paquetes`,
        type: 'request',
        priority: 'high',
        reference_id: request.id,
        entity_type: 'ConsolidationRequest',
        icon: 'alert'
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error creating request notification:', error);
    return Response.json({ success: true });
  }
});