import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { assignShippingMarkToUser, notifyShippingMarkAssigned } from '../../shared/shippingMark.ts';

// Asigna el Shipping Mark a un cliente usando la configuración vigente.
// La lógica del contador global y del código de estado vive en shared/shippingMark.ts
// porque también la usa el alta de clientes que llegan desde la app del mayorista.
export default async function (req) {
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
    const previousUser = payload?.old_data || null;

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

    const assigned = await assignShippingMarkToUser(base44, targetUser);

    if (!assigned.ok) {
      if (assigned.reason === 'state_code_external_missing') {
        return Response.json(
          { success: false, skipped: true, reason: 'state_code_external_missing', message: assigned.error },
          { status: 400 }
        );
      }
      return Response.json({ error: assigned.error }, { status: 500 });
    }

    await notifyShippingMarkAssigned(base44, targetUser, assigned.shipping_mark);

    return Response.json({
      success: true,
      shipping_mark: assigned.shipping_mark,
      assigned: true,
      sequence_number: assigned.sequence_number,
      state_code_external: assigned.state_code_external,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}