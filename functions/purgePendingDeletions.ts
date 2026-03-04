import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // If invoked by a user, require admin; if no user (automation), allow
    let caller = null;
    try { caller = await base44.auth.me(); } catch (_) { caller = null; }
    if (caller && caller.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const now = Date.now();
    const GRACE_MS = 7 * 24 * 60 * 60 * 1000;

    const users = await base44.asServiceRole.entities.User.filter({ deletion_requested: true });

    const deleteByFilter = async (entityName, filter, batchSize = 500) => {
      let total = 0;
      while (true) {
        const list = await base44.asServiceRole.entities[entityName].filter(filter, '-created_date', batchSize);
        if (!list || list.length === 0) break;
        for (const item of list) {
          await base44.asServiceRole.entities[entityName].delete(item.id);
          total += 1;
        }
        if (list.length < batchSize) break;
      }
      return total;
    };

    const results = { processed: 0, purged: 0, skipped: 0, details: [] };

    for (const u of users) {
      const started = u.deletion_requested_at ? Date.parse(u.deletion_requested_at) : null;
      if (!started || (now - started) < GRACE_MS) {
        results.skipped += 1;
        continue;
      }

      const entry = { email: u.email, userId: u.id, counts: {} };

      // 1) Simple relations by email
      entry.counts.notifications = await deleteByFilter('Notification', { user_email: u.email });
      entry.counts.clientNotes = await deleteByFilter('ClientNote', { client_email: u.email });
      entry.counts.supportTickets = await deleteByFilter('SupportTicket', { client_email: u.email });
      entry.counts.consolidationRequests = await deleteByFilter('ConsolidationRequest', { client_email: u.email });

      // 2) Packages and Invoices
      entry.counts.packages = await deleteByFilter('Package', { client_email: u.email });
      entry.counts.invoices = await deleteByFilter('Invoice', { client_email: u.email });

      // 3) Email logs (recipient and sender)
      entry.counts.emailLogs_recipient = await deleteByFilter('EmailLog', { recipient_email: u.email });
      entry.counts.emailLogs_sender = await deleteByFilter('EmailLog', { sender_email: u.email });

      // 4) Consolidations and Accounts Payable linked to them
      const cons = await base44.asServiceRole.entities.Consolidation.filter({ client_email: u.email });
      let apDeleted = 0, apLedgerDeleted = 0;
      for (const c of cons) {
        const aps = await base44.asServiceRole.entities.AccountsPayable.filter({ related_consolidation_id: c.id });
        for (const ap of aps) {
          const apLs = await base44.asServiceRole.entities.AccountsPayableLedger.filter({ ap_id: ap.id });
          for (const l of apLs) { await base44.asServiceRole.entities.AccountsPayableLedger.delete(l.id); apLedgerDeleted += 1; }
          await base44.asServiceRole.entities.AccountsPayable.delete(ap.id); apDeleted += 1;
        }
      }
      entry.counts.apLedgers = apLedgerDeleted;
      entry.counts.accountsPayable = apDeleted;

      entry.counts.consolidations = 0;
      if (cons.length > 0) {
        for (const c of cons) { await base44.asServiceRole.entities.Consolidation.delete(c.id); entry.counts.consolidations += 1; }
      }

      // 5) Log purge audit then delete user
      const purgedAt = new Date().toISOString();
      try {
        await base44.asServiceRole.entities.DeletionAudit.create({
          user_email: u.email,
          action: 'purge',
          performed_by: 'system',
          performed_by_role: 'system',
          at: purgedAt,
          reason: 'grace_period_expired',
          details: { requested_at: u.deletion_requested_at, user_id: u.id }
        });
      } catch (_) { /* no-op */ }

      await base44.asServiceRole.entities.User.delete(u.id);

      results.purged += 1;
      results.details.push(entry);
    }

    results.processed = users.length;

    return Response.json({ success: true, ...results });
  } catch (error) {
    return Response.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
});