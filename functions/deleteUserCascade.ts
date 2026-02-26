import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Admin-only: Deletes a user and all their related data across entities
// Usage (frontend):
//   await base44.functions.invoke('deleteUserCascade', { email: 'user@example.com' })
// or
//   await base44.functions.invoke('deleteUserCascade', { userId: '<user_id>' })

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Authenticate and require admin
    const caller = await base44.auth.me();
    if (!caller) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (caller.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const payload = await req.json().catch(() => ({}));
    const { email, userId } = payload || {};

    if (!email && !userId) {
      return Response.json({ error: 'Missing required parameter: email or userId' }, { status: 400 });
    }

    // Resolve target user
    let targetUser = null;
    if (userId) {
      try {
        targetUser = await base44.asServiceRole.entities.User.get(userId);
      } catch (_) {
        // fallback by email if also provided
      }
    }

    if (!targetUser && email) {
      const users = await base44.asServiceRole.entities.User.filter({ email }, '-created_date', 10);
      targetUser = users && users.length > 0 ? users[0] : null;
    }

    if (!targetUser) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const targetEmail = targetUser.email;

    // Helper to delete records matching a filter; returns count deleted
    const deleteByFilter = async (entityName, filter, limit = 1000) => {
      const list = await base44.asServiceRole.entities[entityName].filter(filter, '-created_date', limit);
      for (const item of list) {
        await base44.asServiceRole.entities[entityName].delete(item.id);
      }
      return list.length;
    };

    // Track results
    const results = {
      notifications: 0,
      clientNotes: 0,
      supportTickets: 0,
      consolidationRequests: 0,
      packages: 0,
      consolidations: 0,
      invoices: 0,
      emailLogs: 0,
      userDeleted: false,
    };

    // 1) Simple direct relations by email
    results.notifications += await deleteByFilter('Notification', { user_email: targetEmail });
    results.clientNotes += await deleteByFilter('ClientNote', { client_email: targetEmail });
    results.supportTickets += await deleteByFilter('SupportTicket', { client_email: targetEmail });
    results.consolidationRequests += await deleteByFilter('ConsolidationRequest', { client_email: targetEmail });

    // 2) Packages by client email
    results.packages += await deleteByFilter('Package', { client_email: targetEmail });

    // 3) Consolidations by client email (collect ids for invoices)
    const consolidations = await base44.asServiceRole.entities.Consolidation.filter({ client_email: targetEmail }, '-created_date', 1000);

    // 4) Invoices: first by client_email
    results.invoices += await deleteByFilter('Invoice', { client_email: targetEmail });

    //    Then for each consolidation_id (in case invoices were stored without client_email)
    for (const c of consolidations) {
      results.invoices += await deleteByFilter('Invoice', { consolidation_id: c.id });
    }

    // 5) Email logs: recipient_email and sender_email
    results.emailLogs += await deleteByFilter('EmailLog', { recipient_email: targetEmail });
    results.emailLogs += await deleteByFilter('EmailLog', { sender_email: targetEmail });

    // 6) Delete consolidations last (after invoices)
    for (const c of consolidations) {
      await base44.asServiceRole.entities.Consolidation.delete(c.id);
      results.consolidations += 1;
    }

    // 7) Finally, delete user
    await base44.asServiceRole.entities.User.delete(targetUser.id);
    results.userDeleted = true;

    return Response.json({ success: true, email: targetEmail, results });
  } catch (error) {
    console.error('deleteUserCascade error:', error);
    return Response.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
});