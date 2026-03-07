import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const OP_ROLES = ['operations_manager', 'warehouse', 'customer_service', 'accounting'];

function classifyCategory(entity) {
  const e = (entity || '').toLowerCase();
  if (['invoice', 'accountspayable', 'accountspayableledger', 'providerpayment', 'providerpaymentledger', 'creditsledger'].includes(e)) {
    return 'FINANCIAL';
  }
  if (['package', 'consolidation', 'consolidationrequest', 'supportticket', 'assistedpaymentrequest'].includes(e)) {
    return 'OPERATIONAL';
  }
  return 'SYSTEM';
}

function pickSummary(entity, data) {
  if (!data || typeof data !== 'object') return '';
  const e = (entity || '').toLowerCase();
  const tryKeys = [
    'tracking_number','consolidation_tracking','invoice_number','ticket_number','subject','name','title','question','email','client_email','shipping_mark','promo_code'
  ];
  for (const k of tryKeys) {
    if (data[k]) return `${k}: ${String(data[k])}`;
  }
  return '';
}

function actionLabel(type) {
  switch (type) {
    case 'create': return 'creado';
    case 'update': return 'actualizado';
    case 'delete': return 'eliminado';
    default: return String(type || 'cambio');
  }
}

function priorityFor(type) {
  if (type === 'delete') return 'HIGH';
  if (type === 'create') return 'MEDIUM';
  return 'LOW';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Automations call without user context; allowed. We'll still guard service calls explicitly.
    const payload = await req.json();
    const { event, data, old_data } = payload || {};

    if (!event || !event.entity_name || !event.type) {
      return Response.json({ success: true, skipped: true, reason: 'missing event' });
    }

    const entity = event.entity_name;
    // Avoid loops/noise
    if (entity === 'AppNotification' || entity === 'NotificationAudit') {
      return Response.json({ success: true, skipped: true, reason: 'excluded entity' });
    }

    const cat = classifyCategory(entity);
    const pri = priorityFor(event.type);
    const summary = pickSummary(entity, data) || `ID: ${event.entity_id || data?.id || ''}`;

    const title = `🔔 ${entity} ${actionLabel(event.type)}`;
    const message = summary;

    // Resolve recipients: Admins + operational roles
    const recipientsSet = new Set();

    // Admins
    try {
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' }, '-created_date', 500);
      (admins || []).forEach(u => u?.email && recipientsSet.add(u.email));
    } catch (_) {}

    // Operational custom roles
    for (const role of OP_ROLES) {
      try {
        const users = await base44.asServiceRole.entities.User.filter({ custom_role: role }, '-created_date', 500);
        (users || []).forEach(u => u?.email && recipientsSet.add(u.email));
      } catch (_) {}
    }

    const recipients = Array.from(recipientsSet);

    // If no recipients, exit gracefully
    if (recipients.length === 0) {
      return Response.json({ success: true, skipped: true, reason: 'no recipients' });
    }

    // Create notifications per recipient
    for (const email of recipients) {
      await base44.asServiceRole.entities.AppNotification.create({
        user_email: email,
        title,
        message,
        category: cat,
        priority: pri,
        type: 'entity_change',
        reference_id: event.entity_id || data?.id,
        resource_type: entity,
        icon: 'info'
      });
    }

    return Response.json({ success: true, notified: recipients.length, entity, type: event.type });
  } catch (error) {
    console.error('notifyEntityChange error:', error);
    return Response.json({ success: false, error: error?.message || String(error) }, { status: 500 });
  }
});