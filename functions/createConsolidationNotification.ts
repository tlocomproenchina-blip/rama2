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

    if (isNew) {
      // Nueva consolidación
      await base44.asServiceRole.entities.Notification.create({
        user_email: consolidation.client_email,
        title: '📦 Consolidación creada',
        message: `Tu consolidación ${consolidation.consolidation_tracking} ha sido creada.`,
        type: 'consolidation',
        priority: 'medium',
        reference_id: consolidation.id,
        entity_type: 'Consolidation',
        icon: 'truck'
      });
    } else if (statusChanged) {
      // Cambio de estado
      const statusMessages = {
        'en_transito': { title: '🚚 En tránsito', priority: 'high' },
        'pago_validado': { title: '✅ Pago validado', priority: 'high' },
        'disponible': { title: '📍 Disponible para retiro', priority: 'high' },
        'entregado': { title: '🎉 Entregado', priority: 'medium' }
      };

      const statusInfo = statusMessages[consolidation.status] || { title: '🔔 Estado actualizado', priority: 'medium' };

      await base44.asServiceRole.entities.Notification.create({
        user_email: consolidation.client_email,
        title: statusInfo.title,
        message: `Tu consolidación ${consolidation.consolidation_tracking} ahora está ${consolidation.status}.`,
        type: 'consolidation',
        priority: statusInfo.priority,
        reference_id: consolidation.id,
        entity_type: 'Consolidation',
        icon: 'truck'
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error creating consolidation notification:', error);
    return Response.json({ success: true });
  }
});