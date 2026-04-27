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

  // Envío vía backend (service role) — evita circuit breaker / rate limit del cliente.
  // El backend se encarga del email + EmailLog + Notification in-app en una sola llamada.
  let emailSent = false;
  try {
    const res = await base44.functions.invoke('sendNotificationEmail', {
      to,
      subject,
      body: body || message || '',
      from_name: fromName,
      in_app: {
        user_email: to,
        title: title || subject,
        message: message || body,
        type,
        icon,
        reference_id: referenceId,
        entity_type: inferEntityTypeFromType(type),
        priority: type === 'package' ? 'high' : 'medium'
      }
    });
    emailSent = !!res?.data?.email_sent;
  } catch (err) {
    console.warn('sendNotificationEmail failed:', err?.message || err);
  }

  return { success: true, email_sent: emailSent };
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

// Compatibilidad con pantallas antiguas: ya no hay cola, devolvemos métricas estáticas
export function getEmailQueueStats() {
  return { pending: 0, sent: 0, batchSize: 0, intervalMs: 0 };
}

function inferEntityTypeFromType(type) {
  switch (type) {
    case 'package': return 'Package';
    case 'consolidation': return 'Consolidation';
    case 'request': return 'ConsolidationRequest';
    default: return 'System';
  }
}

// Notificar a todos los administradores SOLO via centro de notificaciones in-app (sin email).
// Los administradores no necesitan recibir un correo por cada acción de cliente — usan el centro de notificaciones.
export async function notifyAdmins({ subject, body, message, type = 'system', icon = 'bell', referenceId = null }) {
  try {
    const res = await base44.functions.invoke('listAdmins', {});
    const admins = Array.isArray(res?.data?.admins) ? res.data.admins : [];
    if (admins.length === 0) return { success: true, notified: 0 };

    await Promise.all(
      admins.map((a) =>
        sendInAppNotification({
          user_email: a.email,
          title: subject,
          message: message || body,
          type,
          icon,
          reference_id: referenceId,
          entity_type: inferEntityTypeFromType(type),
          priority: type === 'package' ? 'high' : 'medium'
        })
      )
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