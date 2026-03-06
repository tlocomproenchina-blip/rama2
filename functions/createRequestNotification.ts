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

    // NOTIFICACIÓN CRÍTICA: ConsolidationRequest SIEMPRE es crítica (requiere acción)
    // Notificar al cliente
    await base44.asServiceRole.entities.AppNotification.create({
      user_email: request.client_email,
      title: '🔔 Solicitud de consolidación enviada',
      message: `Tu solicitud de consolidación ha sido recibida. Espera aprobación.`,
      type: 'request',
      category: 'OPERATIONAL',
      priority: 'CRITICAL',
      reference_id: request.id,
      resource_type: 'ConsolidationRequest',
      icon: 'alert'
    });

    // Notificar a admins - CRÍTICA
    const users = await base44.asServiceRole.entities.User.list();
    const admins = users.filter(u => u.role === 'admin');

    for (const admin of admins) {
      await base44.asServiceRole.entities.AppNotification.create({
        user_email: admin.email,
        title: '🚨 Nueva solicitud de consolidación (Requiere acción)',
        message: `${request.client_email} solicita consolidar ${request.package_ids?.length || 0} paquetes`,
        type: 'request',
        category: 'OPERATIONAL',
        priority: 'CRITICAL',
        reference_id: request.id,
        resource_type: 'ConsolidationRequest',
        icon: 'alert'
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error creating request notification:', error);
    return Response.json({ success: true });
  }
});