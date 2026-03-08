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

async function processAfterSend() {
  // In-app and push notifications have been disabled; email only.
  return;
}

async function flushEmailQueue() {
  if (emailQueue.length === 0) return;
  const batch = emailQueue.splice(0, EMAIL_BATCH_SIZE);
  for (const item of batch) {
    try {
      if (!item?.to) continue;
      // Enviar directamente vía integraciones (evita doble encolado)
      await base44.integrations.Core.SendEmail({
        from_name: item.from_name || 'TLEC CARGO',
        to: item.to,
        subject: item.subject,
        body: item.body
      });

      emailSentCounter++;
      item.resolve && item.resolve(true);

      // Registrar en EmailLog (best effort)
      try {
        await base44.entities.EmailLog.create({
          recipient_email: item.to,
          from_name: item.from_name || 'TLEC CARGO',
          subject: item.subject,
          body_preview: String(item.body || '').slice(0, 200),
          source: 'manual',
          status: 'sent',
          sent_date: new Date().toISOString()
        });
      } catch (_) {}
    } catch (error) {
      console.error('Notification error:', error);
      // Log de error en EmailLog (best effort)
      try {
        await base44.entities.EmailLog.create({
          recipient_email: item.to,
          from_name: item.from_name || 'TLEC CARGO',
          subject: item.subject,
          body_preview: String(item.body || '').slice(0, 200),
          source: 'manual',
          status: 'failed',
          bounce_reason: error?.message || 'Send failed',
          sent_date: new Date().toISOString()
        });
      } catch (_) {}

      item.reject && item.reject(error);
    }
  }
}

function ensureQueueTimer() {
  if (!queueTimer) {
    queueTimer = setInterval(flushEmailQueue, EMAIL_BATCH_INTERVAL_MS);
  }
  // Flush rápido para no depender del intervalo de 60s
  setTimeout(() => { try { flushEmailQueue(); } catch (_) {} }, 500);
}

export async function getAdmins() {
  try {
    const res = await base44.functions.invoke('listAdmins', {});
    if (res?.status === 200 && Array.isArray(res.data?.admins)) {
      return res.data.admins.map(a => ({ email: a.email, full_name: a.full_name, role: 'admin' }));
    }
  } catch (_) {}
  // Fallback vacío para no romper flujos
  return [];
}

export async function sendNotification({ from_name, to, subject, body, title, message, type = 'general', icon = 'alert', referenceId = null }) {
  ensureQueueTimer();
  return new Promise((resolve, reject) => {
    emailQueue.push({ from_name, to, subject, body, title, message, type, icon, referenceId, resolve, reject });
    // Disparar envío inmediato si el lote es pequeño (< batch)
    if (emailQueue.length < EMAIL_BATCH_SIZE) {
      setTimeout(() => { try { flushEmailQueue(); } catch (_) {} }, 250);
    }
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