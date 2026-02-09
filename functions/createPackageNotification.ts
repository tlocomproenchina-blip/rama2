import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (event.type !== 'create') {
      return Response.json({ success: true });
    }

    const pkg = data;
    if (!pkg.client_email) {
      return Response.json({ success: true });
    }

    // Crear notificación
    await base44.asServiceRole.entities.Notification.create({
      user_email: pkg.client_email,
      title: '📦 Pre-alerta recibida',
      message: `Tu paquete ${pkg.tracking_number} ha sido registrado en el sistema.`,
      type: 'package',
      priority: 'medium',
      reference_id: pkg.id,
      entity_type: 'Package',
      icon: 'package'
    });

    // Notificar a admins
    const users = await base44.asServiceRole.entities.User.list();
    const admins = users.filter(u => u.role === 'admin');

    for (const admin of admins) {
      await base44.asServiceRole.entities.Notification.create({
        user_email: admin.email,
        title: '🔔 Nuevo paquete registrado',
        message: `${pkg.client_email} registró ${pkg.tracking_number}`,
        type: 'package',
        priority: 'low',
        reference_id: pkg.id,
        entity_type: 'Package',
        icon: 'alert'
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error creating package notification:', error);
    return Response.json({ success: true }); // No fallar
  }
});