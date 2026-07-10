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
      const usersById = await base44.asServiceRole.entities.User.filter({ id: userId }, '-created_date', 1);
      targetUser = usersById && usersById.length > 0 ? usersById[0] : null;
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
    const deleteByFilter = async (entityName, filter, batchSize = 500) => {
      let total = 0;
      // Loop until no more records match
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
      accountsPayable: 0,
      apLedgers: 0,
      providerPayments: 0,
      providerPaymentLedgers: 0,
      userDeleted: false,
    };

    // 1) Simple direct relations by email
    results.notifications += await deleteByFilter('Notification', { user_email: targetEmail });
    results.clientNotes += await deleteByFilter('ClientNote', { client_email: targetEmail });
    results.supportTickets += await deleteByFilter('SupportTicket', { client_email: targetEmail });
    results.consolidationRequests += await deleteByFilter('ConsolidationRequest', { client_email: targetEmail });

    // 2) Packages by client email
    results.packages += await deleteByFilter('Package', { client_email: targetEmail });

    // 3) Invoices by client email
    results.invoices += await deleteByFilter('Invoice', { client_email: targetEmail });

    // 4) Email logs: recipient_email and sender_email
    results.emailLogs += await deleteByFilter('EmailLog', { recipient_email: targetEmail });
    results.emailLogs += await deleteByFilter('EmailLog', { sender_email: targetEmail });

    // 5) Consolidations by client email (after invoices)
    // Eliminar AP y pagos de proveedor asociados a consolidaciones del cliente
    const clientCons = await base44.asServiceRole.entities.Consolidation.filter({ client_email: targetEmail });
    for (const cons of clientCons) {
      const aps = await base44.asServiceRole.entities.AccountsPayable.filter({ related_consolidation_id: cons.id });
      for (const ap of aps) {
        const apLs = await base44.asServiceRole.entities.AccountsPayableLedger.filter({ ap_id: ap.id });
        for (const l of apLs) { await base44.asServiceRole.entities.AccountsPayableLedger.delete(l.id); results.apLedgers += 1; }

        const pps = await base44.asServiceRole.entities.ProviderPayment.filter({ provider_name: ap.vendor_name });
        for (const pp of pps) {
          const allocs = Array.isArray(pp.allocations) ? pp.allocations : [];
          if (allocs.some(a => a.ap_id === ap.id)) {
            const refKey = pp.reference || `PP:${pp.id}`;
            const ppl = await base44.asServiceRole.entities.ProviderPaymentLedger.filter({ provider_name: pp.provider_name, transaction_type: 'pago', reference: refKey });
            for (const row of ppl) { await base44.asServiceRole.entities.ProviderPaymentLedger.delete(row.id); results.providerPaymentLedgers += 1; }
            await base44.asServiceRole.entities.ProviderPayment.delete(pp.id);
            results.providerPayments += 1;
          }
        }

        await base44.asServiceRole.entities.AccountsPayable.delete(ap.id);
        results.accountsPayable += 1;
      }
    }

    results.consolidations += await deleteByFilter('Consolidation', { client_email: targetEmail });

    // 7) Finally, delete user
    await base44.asServiceRole.entities.User.delete(targetUser.id);
    results.userDeleted = true;

    // Strict audit logging for cascade deletions (best-effort)
    try {
      await base44.asServiceRole.entities.ActivityAuditLog.create({
        entity_name: 'User',
        entity_id: targetUser.id,
        entity_label: targetEmail,
        action_type: 'delete',
        action_detail: JSON.stringify(results),
        actor_email: caller.email,
        actor_name: caller.full_name || caller.email,
        actor_role: caller.role,
        module_name: 'deleteUserCascade',
        summary: `Eliminación en cascada del usuario ${targetEmail}`,
      });
    } catch (_) { /* no bloquear la respuesta por el log */ }

    return Response.json({ success: true, email: targetEmail, results });
  } catch (error) {
    console.error('deleteUserCascade error:', error);
    return Response.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
});