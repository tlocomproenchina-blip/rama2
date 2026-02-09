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

    // SOLO generar notificación para eventos críticos
    const isCritical = pkg.has_insurance || pkg.status === 'requires_attention';
    
    if (!isCritical) {
      return Response.json({ success: true });
    }

    // Crear notificación CRÍTICA
    const criticalTitle = pkg.has_insurance 
      ? '⚠️ Paquete asegurado registrado'
      : '🚨 Paquete requiere atención';
    
    const criticalMessage = pkg.has_insurance
      ? `Tu paquete ${pkg.tracking_number} ha sido registrado con seguro.`
      : `Tu paquete ${pkg.tracking_number} requiere atención.`;

    await base44.asServiceRole.entities.Notification.create({
      user_email: pkg.client_email,
      title: criticalTitle,
      message: criticalMessage,
      type: 'package',
      priority: 'critical',
      reference_id: pkg.id,
      entity_type: 'Package',
      icon: 'alert'
    });

    // Notificar a admins solo en casos críticos
    const users = await base44.asServiceRole.entities.User.list();
    const admins = users.filter(u => u.role === 'admin');

    for (const admin of admins) {
      await base44.asServiceRole.entities.Notification.create({
        user_email: admin.email,
        title: criticalTitle,
        message: `${pkg.client_email} - ${pkg.tracking_number}`,
        type: 'package',
        priority: 'critical',
        reference_id: pkg.id,
        entity_type: 'Package',
        icon: 'alert'
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error creating package notification:', error);
    return Response.json({ success: true });
  }
});