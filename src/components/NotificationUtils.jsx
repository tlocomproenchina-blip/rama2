import { base44 } from '@/components/api/ApiQueueManager';

// Email sending queue (batch 50 every 60s)
const EMAIL_BATCH_SIZE = 50;
const EMAIL_BATCH_INTERVAL_MS = 60000;
let emailQueue = [];
let queueTimer = null;
let emailSentCounter = 0;

export function getEmailQueueStats() {
  return {
    pending: emailQueue.length,
    sent: emailSentCounter,
    batchSize: EMAIL_BATCH_SIZE,
    intervalMs: EMAIL_BATCH_INTERVAL_MS
  };
}

async function processAfterSend({ to, subject, body, title, message, type = 'general', icon = 'alert', referenceId = null }) {
  // Evitar duplicados recientes (mismo usuario, título y referencia) en los últimos 60s
  const _title = title || subject;
  const _message = message || body.split('\n')[0];
  let shouldCreate = true;
  try {
    if (referenceId) {
      const existing = await base44.entities.Notification.filter({
        user_email: to,
        reference_id: referenceId,
        title: _title
      }, '-created_date', 1);
      if (existing && existing.length > 0) {
        const last = existing[0];
        const diffMs = Date.now() - new Date(last.created_date).getTime();
        if (diffMs < 60000) {
          shouldCreate = false;
        }
      }
    }
  } catch {}

  if (shouldCreate) {
    await base44.entities.Notification.create({
      user_email: to,
      title: _title,
      message: _message,
      type,
      icon,
      reference_id: referenceId
    });
  }

  // Send push notification
  try {
    await base44.functions.invoke('sendPushNotification', {
      userEmail: to,
      title: title || subject,
      body: message || body.split('\n')[0],
      url: '/'
    });
  } catch {
    console.log('Push notification not sent (user may not be subscribed)');
  }
}

async function flushEmailQueue() {
  if (emailQueue.length === 0) return;
  const batch = emailQueue.splice(0, EMAIL_BATCH_SIZE);
  for (const item of batch) {
    try {
      await base44.enqueue(async () => {
        return await base44.integrations.Core.SendEmail({ from_name: item.from_name || 'TLEC CARGO', to: item.to, subject: item.subject, body: item.body });
      }, 'HIGH', 'write');
      await processAfterSend(item);
      emailSentCounter++;
      item.resolve && item.resolve(true);
    } catch (error) {
      console.error('Notification error:', error);
      item.reject && item.reject(error);
    }
  }
}

function ensureQueueTimer() {
  if (!queueTimer) {
    queueTimer = setInterval(flushEmailQueue, EMAIL_BATCH_INTERVAL_MS);
  }
}

export async function getAdmins() {
  const allUsers = await base44.entities.User.list();
  return allUsers.filter(u => u.role === 'admin');
}

export async function sendNotification({ from_name, to, subject, body, title, message, type = 'general', icon = 'alert', referenceId = null }) {
  ensureQueueTimer();
  return new Promise((resolve, reject) => {
    emailQueue.push({ from_name, to, subject, body, title, message, type, icon, referenceId, resolve, reject });
  });
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