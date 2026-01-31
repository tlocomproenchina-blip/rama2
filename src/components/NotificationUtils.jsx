import { base44 } from '@/api/base44Client';

export async function getAdmins() {
  const allUsers = await base44.entities.User.list();
  return allUsers.filter(u => u.role === 'admin');
}

export async function sendNotification({ to, subject, body, title, message, type = 'general', icon = 'alert', referenceId = null }) {
  try {
    await base44.integrations.Core.SendEmail({ to, subject, body });
    await base44.entities.Notification.create({
      user_email: to,
      title: title || subject,
      message: message || body.split('\n')[0],
      type,
      icon,
      reference_id: referenceId
    });

    // Send push notification
    try {
      await base44.functions.invoke('sendPushNotification', {
        userEmail: to,
        title: title || subject,
        body: message || body.split('\n')[0],
        url: '/'
      });
    } catch (pushError) {
      console.log('Push notification not sent (user may not be subscribed)');
    }
  } catch (error) {
    console.error('Notification error:', error);
  }
}

export async function notifyAdmins({ subject, body, title, message, type = 'general', icon = 'alert', referenceId = null }) {
  try {
    const admins = await getAdmins();
    await Promise.all(admins.map(admin => 
      sendNotification({ to: admin.email, subject, body, title, message, type, icon, referenceId })
    ));
  } catch (error) {
    console.error('Admin notification error:', error);
  }
}

export const STATUS_MESSAGES = {
  package: {
    recibido: { subject: '📦 Paquete Recibido', icon: 'check' },
    en_transito: { subject: '🚚 En Tránsito', icon: 'truck' },
    disponible: { subject: '📍 Disponible para Retiro', icon: 'package' },
    entregado: { subject: '✅ Entregado', icon: 'check' }
  },
  consolidation: {
    disponible: { subject: '📦 Disponible para Retiro', icon: 'package' },
    entregado: { subject: '✅ Entregado', icon: 'check' }
  }
};

export async function notifyPackageStatus(pkg, status) {
  const msg = STATUS_MESSAGES.package[status];
  if (!msg) return;
  
  await sendNotification({
    to: pkg.client_email,
    subject: `${msg.subject} - ${pkg.tracking_number}`,
    body: `${msg.subject}\n\nTracking: ${pkg.tracking_number}\nShipping Mark: ${pkg.shipping_mark || 'N/A'}`,
    type: 'package',
    icon: msg.icon,
    referenceId: pkg.id
  });
}

export async function notifyConsolidationStatus(consolidation, status) {
  const msg = STATUS_MESSAGES.consolidation[status];
  if (!msg) return;
  
  await sendNotification({
    to: consolidation.client_email,
    subject: `${msg.subject} - ${consolidation.consolidation_tracking}`,
    body: `${msg.subject}\n\nTracking: ${consolidation.consolidation_tracking}\nShipping Mark: ${consolidation.shipping_mark || 'N/A'}`,
    type: 'consolidation',
    icon: msg.icon,
    referenceId: consolidation.id
  });
}