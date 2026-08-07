import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { sendBrevoEmail } from '../../shared/brevoEmail.ts';

const DEFAULT_PREFIX = 'TLEC-';
const DEFAULT_LENGTH = 6;
const DEFAULT_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const getRandomPart = (chars, length) => {
  let value = '';
  for (let i = 0; i < length; i += 1) {
    const index = Math.floor(Math.random() * chars.length);
    value += chars[index];
  }
  return value;
};

const replaceTemplateVariables = (text, variables = {}) => {
  let result = String(text || '');
  Object.entries(variables).forEach(([key, value]) => {
    result = result.split(`{${key}}`).join(String(value ?? ''));
    result = result.split(`{{${key}}}`).join(String(value ?? ''));
  });
  return result;
};

const getPersonName = (person = {}) => {
  if (person.first_name && person.last_name) return `${person.first_name} ${person.last_name}`;
  return person.full_name || person.email || 'Usuario';
};

const notifyShippingMarkAssigned = async (base44, targetUser, shippingMark) => {
  if (!targetUser?.email || !shippingMark) return;

  const appConfigs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1);
  const appConfig = appConfigs?.[0] || {};
  const templateRows = await base44.asServiceRole.entities.EmailTemplate.filter({ name: 'Base - Shipping Mark Asignado' }, '-updated_date', 1);
  const template = templateRows?.[0] || null;
  const fromName = appConfig.invoice_company_name || appConfig.app_name || 'TLEC CARGO';
  const variables = {
    cliente_nombre: getPersonName(targetUser),
    shipping_mark: shippingMark,
  };
  const subject = replaceTemplateVariables(template?.subject || 'Tu Shipping Mark ha sido asignado', variables);
  const body = replaceTemplateVariables(template?.body || 'Hola {cliente_nombre}, tu Shipping Mark es {shipping_mark}.', variables);

  try {
    const result = await sendBrevoEmail(base44, {
      to: targetUser.email,
      subject,
      body,
      from_name: fromName,
    });

    await base44.asServiceRole.entities.EmailLog.create({
      recipient_email: targetUser.email,
      recipient_name: null,
      sender_email: null,
      from_name: fromName,
      subject,
      body_preview: body.slice(0, 200),
      source: 'manual',
      status: result.sent ? 'sent' : 'failed',
      sent_date: new Date().toISOString(),
    });
  } catch (error) {
    await base44.asServiceRole.entities.EmailLog.create({
      recipient_email: targetUser.email,
      recipient_name: null,
      sender_email: null,
      from_name: fromName,
      subject,
      body_preview: body.slice(0, 200),
      source: 'manual',
      status: 'failed',
      sent_date: new Date().toISOString(),
    });
  }

  await base44.asServiceRole.entities.Notification.create({
    user_email: targetUser.email,
    title: 'Shipping Mark asignado',
    message: `Tu código asignado es ${shippingMark}.`,
    type: 'system',
    priority: 'high',
    reference_id: targetUser.id,
    entity_type: 'System',
    icon: 'check',
    read: false,
  });
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let payload = {};
    try {
      payload = await req.json();
    } catch (_) {
      payload = {};
    }

    const isAutomation = payload?.event?.entity_name === 'User';

    let authedUser = null;
    try {
      authedUser = await base44.auth.me();
    } catch (_) {
      authedUser = null;
    }

    if (!isAutomation && !authedUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const appConfigs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1);
    const appConfig = appConfigs?.[0] || null;

    if (!appConfig?.shipping_mark_auto_assign_enabled) {
      return Response.json({ success: true, skipped: true, reason: 'disabled' });
    }

    let targetUser = null;
    let previousUser = payload?.old_data || null;

    if (isAutomation) {
      targetUser = payload?.data || null;
      if ((!targetUser || payload?.payload_too_large) && payload?.event?.entity_id) {
        const rows = await base44.asServiceRole.entities.User.filter({ id: payload.event.entity_id }, '-updated_date', 1);
        targetUser = rows?.[0] || null;
      }
    } else if (payload?.user_id && authedUser?.role === 'admin') {
      const rows = await base44.asServiceRole.entities.User.filter({ id: payload.user_id }, '-updated_date', 1);
      targetUser = rows?.[0] || null;
    } else {
      targetUser = authedUser;
    }

    if (!targetUser) {
      return Response.json({ success: true, skipped: true, reason: 'user_not_found' });
    }

    if (targetUser.role !== 'user') {
      return Response.json({ success: true, skipped: true, reason: 'not_client' });
    }

    if (!targetUser.profile_completed) {
      return Response.json({ success: true, skipped: true, reason: 'profile_incomplete' });
    }

    if (targetUser.shipping_mark) {
      return Response.json({ success: true, shipping_mark: targetUser.shipping_mark, assigned: false, skipped: true, reason: 'already_exists' });
    }

    if (isAutomation && payload?.event?.type === 'update' && previousUser?.shipping_mark) {
      return Response.json({ success: true, skipped: true, reason: 'already_had_mark' });
    }

    const prefix = String(appConfig?.shipping_mark_auto_assign_prefix || appConfig?.shipping_mark_prefix || DEFAULT_PREFIX).toUpperCase();
    const length = Math.max(1, Number(appConfig?.shipping_mark_auto_assign_length) || DEFAULT_LENGTH);
    const chars = String(appConfig?.shipping_mark_auto_assign_chars || DEFAULT_CHARS).toUpperCase();

    if (!chars.length) {
      return Response.json({ error: 'Shipping mark characters not configured' }, { status: 400 });
    }

    let shippingMark = '';

    // Helper: verify a candidate SM is not already assigned to any user
    const isUnique = async (candidate) => {
      const existing = await base44.asServiceRole.entities.User.filter({ shipping_mark: candidate }, '-updated_date', 1);
      return !existing?.length;
    };

    // Try pool first
    const availableCodes = await base44.asServiceRole.entities.ShippingMarkCode.filter({ status: 'available' }, 'created_date', 5);
    for (const pooledCode of (availableCodes || [])) {
      const candidate = String(pooledCode.code).trim().toUpperCase();
      if (await isUnique(candidate)) {
        shippingMark = candidate;
        await base44.asServiceRole.entities.ShippingMarkCode.update(pooledCode.id, {
          status: 'assigned',
          assigned_to_email: targetUser.email || '',
          assigned_date: new Date().toISOString()
        });
        break;
      } else {
        // Mark pool code as used/conflicted so it's not reused
        await base44.asServiceRole.entities.ShippingMarkCode.update(pooledCode.id, {
          status: 'assigned',
          assigned_to_email: 'CONFLICTO-DUPLICADO',
          assigned_date: new Date().toISOString()
        });
      }
    }

    // If pool didn't yield a unique code, generate random
    if (!shippingMark) {
      let attempts = 0;
      while (attempts < 20) {
        const candidate = `${prefix}${getRandomPart(chars, length)}`;
        if (await isUnique(candidate)) {
          shippingMark = candidate;
          break;
        }
        attempts += 1;
      }
    }

    if (!shippingMark) {
      return Response.json({ error: 'No se pudo generar un Shipping Mark único' }, { status: 500 });
    }

    await base44.asServiceRole.entities.User.update(targetUser.id, { shipping_mark: shippingMark });

    if (targetUser.email) {
      const packages = await base44.asServiceRole.entities.Package.filter({ client_email: targetUser.email }, '-updated_date', 200);
      const packagesToUpdate = (packages || []).filter((pkg) => !pkg.shipping_mark);
      for (const pkg of packagesToUpdate) {
        await base44.asServiceRole.entities.Package.update(pkg.id, { shipping_mark: shippingMark });
      }
    }

    await notifyShippingMarkAssigned(base44, targetUser, shippingMark);

    return Response.json({ success: true, shipping_mark: shippingMark, assigned: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});