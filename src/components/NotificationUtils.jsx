import { base44 } from '@/components/api/ApiQueueManager';
import { ensureBaseNotificationTemplates, markTemplateAsUsed, renderEmailTemplate } from '@/lib/notificationTemplates';

// Reescritura completa del sistema de notificaciones por email
// Objetivos:
// - Envío inmediato usando Core.SendEmail (sin colas ni esperas)
// - Registro en EmailLog con estado
// - Notificación in-app en la entidad Notification
// - Mantener API pública existente: sendNotification, notifyPackageStatus, notifyAdmins

let CACHED_FROM_NAME = null;

async function getFromName() {
  if (CACHED_FROM_NAME) return CACHED_FROM_NAME;
  try {
    const cfgs = await base44.entities.AppConfig.filter({ config_key: 'main' });
    const cfg = cfgs?.[0] || {};
    CACHED_FROM_NAME = cfg.invoice_company_name || cfg.app_name || 'TLEC CARGO';
    return CACHED_FROM_NAME;
  } catch (_) {
    CACHED_FROM_NAME = 'TLEC CARGO';
    return CACHED_FROM_NAME;
  }
}

async function createEmailLog({ to, subject, body, source = 'manual', status = 'sent', campaign_id = null, campaign_name = null }) {
  const preview = String(body || '').slice(0, 200);
  try {
    await base44.entities.EmailLog.create({
      recipient_email: to,
      recipient_name: null,
      sender_email: null,
      from_name: await getFromName(),
      subject,
      body_preview: preview,
      campaign_id,
      campaign_name,
      source,
      status,
      sent_date: new Date().toISOString()
    });
  } catch (_) {
    // no bloquear por logging
  }
}

export async function sendInAppNotification({ user_email, title, message, type = 'system', icon = 'bell', reference_id = null, entity_type = 'System', priority = 'medium' }) {
  if (!user_email) return;
  try {
    await base44.entities.Notification.create({
      user_email,
      title: title || message || 'Notificación',
      message: message || title || '',
      type,
      priority,
      reference_id,
      entity_type,
      icon,
      read: false
    });
  } catch (_) {
    // no bloquear por notificación
  }
}

export async function sendNotification({ from_name, to, subject, body, title, message, type = 'general', icon = 'alert', referenceId = null }) {
  if (!to) throw new Error('Falta destinatario (to)');
  if (!subject) throw new Error('Falta asunto (subject)');

  const fromName = from_name || (await getFromName());

  // 1) Enviar email
  try {
    await base44.integrations.Core.SendEmail({
      to,
      subject,
      body: body || message || '',
      from_name: fromName
    });
    // 2) Log + notificación in-app (no bloquear si fallan)
    createEmailLog({ to, subject, body, status: 'sent' });
    sendInAppNotification({
      user_email: to,
      title: title || subject,
      message: message || body,
      type,
      icon,
      reference_id: referenceId,
      entity_type: inferEntityTypeFromType(type),
      priority: type === 'package' ? 'high' : 'medium'
    });
    return { success: true };
  } catch (err) {
    // Registrar fallido y propagar error para que la UI pueda avisar
    createEmailLog({ to, subject, body, status: 'failed' });
    throw err;
  }
}

export async function sendTemplatedEmail({
  to,
  templateName,
  variables = {},
  client = {},
  user = {},
  extraData = {},
  fallbackSubject = '',
  fallbackBody = '',
  from_name,
  title,
  message,
  type = 'general',
  icon = 'alert',
  referenceId = null,
}) {
  await ensureBaseNotificationTemplates();

  const rendered = await renderEmailTemplate({
    templateName,
    variables,
    client,
    user,
    extraData,
    fallbackSubject,
    fallbackBody,
  });

  const response = await sendNotification({
    from_name,
    to,
    subject: rendered.subject,
    body: rendered.body,
    title: title || rendered.subject,
    message: message || rendered.body,
    type,
    icon,
    referenceId,
  });

  if (rendered.template) {
    markTemplateAsUsed(rendered.template);
  }

  return response;
}

function inferEntityTypeFromType(type) {
  switch (type) {
    case 'package': return 'Package';
    case 'consolidation': return 'Consolidation';
    case 'request': return 'ConsolidationRequest';
    default: return 'System';
  }
}

// Compatibilidad con pantallas antiguas: ya no hay cola, devolvemos métricas estáticas
export function getEmailQueueStats() {
  return { pending: 0, sent: 0, batchSize: 0, intervalMs: 0 };
}

// Notificar a todos los administradores (usa backend listAdmins con service role)
export async function notifyAdmins({ subject, body, message, type = 'system', icon = 'bell', referenceId = null }) {
  try {
    const res = await base44.functions.invoke('listAdmins', {});
    const admins = Array.isArray(res?.data?.admins) ? res.data.admins : [];
    if (admins.length === 0) return { success: true, notified: 0 };

    await Promise.all(
      admins.map(async (a) => {
        await sendNotification({
          to: a.email,
          subject,
          body,
          title: subject,
          message: message || body,
          type,
          icon,
          referenceId
        });
      })
    );

    return { success: true, notified: admins.length };
  } catch (error) {
    console.error('notifyAdmins failed:', error);
    return { success: false, notified: 0 };
  }
}

// Notificaciones estándar de estado de paquete (usada por AdminPackages)
export async function notifyPackageStatus(pkg, newStatus) {
  if (!pkg || !pkg.client_email) return { success: false, error: 'Paquete inválido' };

  const map = {
    en_transito: {
      subject: '🚚 Tu paquete está en tránsito',
      body: `Tu paquete ${pkg.tracking_number} está en tránsito hacia su destino.`,
      icon: 'truck'
    },
    disponible: {
      subject: '📦 Paquete disponible para retiro/entrega',
      body: `Tu paquete ${pkg.tracking_number} está disponible. Por favor coordina retiro o entrega.`,
      icon: 'check'
    },
    entregado: {
      subject: '✅ Paquete entregado',
      body: `Tu paquete ${pkg.tracking_number} ha sido entregado. ¡Gracias por confiar en nosotros!`,
      icon: 'check'
    },
    recibido: {
      subject: '📥 Paquete recibido en warehouse',
      body: `Tu paquete ${pkg.tracking_number} ha sido recibido en nuestro almacén.`,
      icon: 'package'
    },
    rechazado: {
      subject: '⛔ Paquete rechazado en almacén',
      body: `Tu paquete ${pkg.tracking_number} fue recibido en almacén, pero fue rechazado y no podrá exportarse. Por favor contacta a soporte para más información.`,
      icon: 'alert'
    }
  };

  const conf = map[newStatus];
  if (!conf) return { success: true, skipped: true };

  return await sendNotification({
    to: pkg.client_email,
    subject: conf.subject,
    body: conf.body,
    title: conf.subject,
    message: conf.body,
    type: 'package',
    icon: conf.icon,
    referenceId: pkg.id || pkg.tracking_number
  });
}