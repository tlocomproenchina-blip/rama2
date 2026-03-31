import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event_type, entity_name, entity_id, data, old_data } = await req.json();

    // Get all admins
    const admins = await base44.asServiceRole.entities.User.list();
    const adminEmails = admins.filter(u => u.role === 'admin').map(u => u.email);

    if (adminEmails.length === 0) {
      return Response.json({ success: true, message: 'No admins found' });
    }

    // Define notification templates based on entity type
    const notificationTemplates = {
      Package: {
        create: {
          title: '📦 Nuevo Paquete',
          message: `Nuevo paquete: ${data?.tracking_number || 'sin tracking'}`,
          type: 'package',
          icon: 'package'
        },
        update: {
          title: '✏️ Paquete Actualizado',
          message: `Paquete ${data?.tracking_number || 'sin tracking'} ha sido actualizado`,
          type: 'package',
          icon: 'alert'
        },
        delete: {
          title: '🗑️ Paquete Eliminado',
          message: `Paquete ${old_data?.tracking_number || 'sin tracking'} ha sido eliminado`,
          type: 'package',
          icon: 'alert'
        }
      },
      Consolidation: {
        create: {
          title: '📦 Nueva Consolidación',
          message: `Consolidación: ${data?.consolidation_tracking || 'sin tracking'}`,
          type: 'consolidation',
          icon: 'truck'
        },
        update: {
          title: '✏️ Consolidación Actualizada',
          message: `Consolidación ${data?.consolidation_tracking || 'sin tracking'} - Status: ${data?.status || 'desconocido'}`,
          type: 'consolidation',
          icon: 'alert'
        },
        delete: {
          title: '🗑️ Consolidación Eliminada',
          message: `Consolidación ${old_data?.consolidation_tracking || 'sin tracking'} ha sido eliminada`,
          type: 'consolidation',
          icon: 'alert'
        }
      },
      ConsolidationRequest: {
        create: {
          title: '🛒 Nueva Solicitud',
          message: `Solicitud de consolidación de ${data?.client_email || 'cliente'}`,
          type: 'consolidation',
          icon: 'truck'
        },
        update: {
          title: '🛒 Solicitud Actualizada',
          message: `Solicitud de ${data?.client_email || 'cliente'} - Status: ${data?.status || 'desconocido'}`,
          type: 'consolidation',
          icon: 'alert'
        }
      }
    };

    const template = notificationTemplates[entity_name]?.[event_type];
    if (!template) {
      return Response.json({ success: true, message: 'No template for this event' });
    }

    // Create notifications for all admins
    const notificationPromises = adminEmails.map(email =>
      base44.asServiceRole.entities.Notification.create({
        user_email: email,
        title: template.title,
        message: template.message,
        type: template.type,
        icon: template.icon,
        reference_id: entity_id,
        read: false
      }).catch(err => console.error(`Error notifying ${email}:`, err))
    );

    await Promise.all(notificationPromises);

    return Response.json({ success: true, message: `Notified ${adminEmails.length} admins` });
  } catch (error) {
    console.error('Function error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});