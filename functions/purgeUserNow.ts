import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (caller.role !== 'admin') return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });

    let payload = {};
    try { payload = await req.json(); } catch { payload = {}; }
    const { user_id, email, reason } = payload || {};

    let target = null;
    if (user_id) {
      const users = await base44.asServiceRole.entities.User.filter({ id: user_id });
      target = users?.[0] || null;
    } else if (email) {
      const users = await base44.asServiceRole.entities.User.filter({ email });
      target = users?.[0] || null;
    }
    if (!target) return Response.json({ error: 'User not found' }, { status: 404 });

    // Cascade delete similar to scheduled purge
    const deleteByFilter = async (entityName, filter, batchSize = 500) => {
      let total = 0;
      while (true) {
        const list = await base44.asServiceRole.entities[entityName].filter(filter, '-created_date', batchSize);
        if (!list || list.length === 0) break;
        for (const item of list) { await base44.asServiceRole.entities[entityName].delete(item.id); total += 1; }
        if (list.length < batchSize) break;
      }
      return total;
    };

    const summary = { email: target.email, userId: target.id, counts: {} };

    summary.counts.notifications = await deleteByFilter('Notification', { user_email: target.email });
    summary.counts.clientNotes = await deleteByFilter('ClientNote', { client_email: target.email });
    summary.counts.supportTickets = await deleteByFilter('SupportTicket', { client_email: target.email });
    summary.counts.consolidationRequests = await deleteByFilter('ConsolidationRequest', { client_email: target.email });
    summary.counts.packages = await deleteByFilter('Package', { client_email: target.email });
    summary.counts.invoices = await deleteByFilter('Invoice', { client_email: target.email });
    summary.counts.emailLogs_recipient = await deleteByFilter('EmailLog', { recipient_email: target.email });
    summary.counts.emailLogs_sender = await deleteByFilter('EmailLog', { sender_email: target.email });

    const cons = await base44.asServiceRole.entities.Consolidation.filter({ client_email: target.email });
    let apDeleted = 0, apLedgerDeleted = 0, consDeleted = 0;
    for (const c of cons) {
      const aps = await base44.asServiceRole.entities.AccountsPayable.filter({ related_consolidation_id: c.id });
      for (const ap of aps) {
        const apLs = await base44.asServiceRole.entities.AccountsPayableLedger.filter({ ap_id: ap.id });
        for (const l of apLs) { await base44.asServiceRole.entities.AccountsPayableLedger.delete(l.id); apLedgerDeleted += 1; }
        await base44.asServiceRole.entities.AccountsPayable.delete(ap.id); apDeleted += 1;
      }
      await base44.asServiceRole.entities.Consolidation.delete(c.id); consDeleted += 1;
    }
    summary.counts.apLedgers = apLedgerDeleted;
    summary.counts.accountsPayable = apDeleted;
    summary.counts.consolidations = consDeleted;

    const purgedAt = new Date().toISOString();
    await base44.asServiceRole.entities.DeletionAudit.create({
      user_email: target.email,
      action: 'purge',
      performed_by: caller.email,
      performed_by_role: 'admin',
      at: purgedAt,
      reason: reason || 'manual_purge',
      details: { requested_at: target.deletion_requested_at, user_id: target.id, admin_id: caller.id }
    });

    await base44.asServiceRole.entities.User.delete(target.id);

    return Response.json({ success: true, summary });
  } catch (error) {
    return Response.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
});