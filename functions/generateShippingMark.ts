import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

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
    let attempts = 0;

    while (attempts < 20) {
      const candidate = `${prefix}${getRandomPart(chars, length)}`;
      const existing = await base44.asServiceRole.entities.User.filter({ shipping_mark: candidate }, '-updated_date', 1);
      if (!existing?.length) {
        shippingMark = candidate;
        break;
      }
      attempts += 1;
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

    return Response.json({ success: true, shipping_mark: shippingMark, assigned: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});