import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const {
      entityType, // 'Package' | 'Consolidation' | 'ConsolidationRequest' | 'Invoice' | 'SupportTicket' | 'AccountsPayable'
      entityId,
      title,
      message,
      affectedEmail, // usuario afectado principal
      notifyAdmins = true,
      priority = 'medium',
      icon = 'bell',
      type // optional override like 'package','invoice','support', else derived
    } = payload || {};

    if (!entityType || !title || !message) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const typeMap = {
      Package: 'package',
      Consolidation: 'consolidation',
      ConsolidationRequest: 'request',
      Invoice: 'invoice',
      SupportTicket: 'support',
      AccountsPayable: 'accounts_payable',
      System: 'system'
    };

    const notifType = type || typeMap[entityType] || 'system';

    const targets = new Set();
    if (affectedEmail) targets.add(affectedEmail);

    if (notifyAdmins) {
      const admins = await base44.entities.User.filter({ role: 'admin' });
      admins.forEach(a => a?.email && targets.add(a.email));
    }

    const records = Array.from(targets).map(email => ({
      user_email: email,
      title,
      message,
      type: notifType,
      priority,
      reference_id: entityId || null,
      entity_type: entityType,
      icon,
      read: false,
    }));

    if (records.length === 0) {
      return Response.json({ created: 0 });
    }

    await base44.entities.Notification.bulkCreate(records);

    return Response.json({ created: records.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});