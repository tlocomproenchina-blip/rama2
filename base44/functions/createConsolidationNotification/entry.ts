import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data, old_data } = await req.json();

    const consolidation = data;
    if (!consolidation.client_email) {
      return Response.json({ success: true });
    }

    const isNew = event.type === 'create';
    const statusChanged = old_data && old_data.status !== consolidation.status;

    // SOLO notificar en casos críticos
    const criticalStatuses = [
      'requires_attention',
      'payment_rejected',
      'error'
    ];

    let shouldNotify = false;
    let notificationData = null;

    if (isNew && criticalStatuses.includes(consolidation.status)) {
      // Nueva consolidación con estado crítico
      shouldNotify = true;
      notificationData = {
        title: '🚨 Consolidación con error',
        message: `Tu consolidación ${consolidation.consolidation_tracking} requiere atención.`,
        priority: 'critical'
      };
    } else if (statusChanged && criticalStatuses.includes(consolidation.status)) {
      // Cambio a estado crítico
      shouldNotify = true;
      notificationData = {
        title: '🚨 Consolidación requiere atención',
        message: `Tu consolidación ${consolidation.consolidation_tracking} requiere atención inmediata.`,
        priority: 'critical'
      };
    }

    if (!shouldNotify) {
      return Response.json({ success: true });
    }

    // Crear notificación CRÍTICA
    await base44.asServiceRole.entities.Notification.create({
      user_email: consolidation.client_email,
      title: notificationData.title,
      message: notificationData.message,
      type: 'consolidation',
      priority: notificationData.priority,
      reference_id: consolidation.id,
      entity_type: 'Consolidation',
      icon: 'alert'
    });

    // Notificar a admins
    const users = await base44.asServiceRole.entities.User.list();
    const admins = users.filter(u => u.role === 'admin');

    for (const admin of admins) {
      await base44.asServiceRole.entities.Notification.create({
        user_email: admin.email,
        title: notificationData.title,
        message: `${consolidation.client_email} - ${consolidation.consolidation_tracking}`,
        type: 'consolidation',
        priority: 'critical',
        reference_id: consolidation.id,
        entity_type: 'Consolidation',
        icon: 'alert'
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error creating consolidation notification:', error);
    return Response.json({ success: true });
  }
});