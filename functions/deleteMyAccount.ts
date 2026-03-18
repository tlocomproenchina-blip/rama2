import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const targetEmail = user.email;
    const targetUserId = user.id;

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const withRetry = async (operation, retries = 4) => {
      for (let attempt = 0; attempt < retries; attempt += 1) {
        try {
          return await operation();
        } catch (error) {
          const status = error?.status || error?.response?.status;
          if (status !== 429 || attempt === retries - 1) throw error;
          await sleep(500 * (attempt + 1));
        }
      }
    };

    const deleteByFilter = async (entityName, filter, batchSize = 50) => {
      let total = 0;
      while (true) {
        const records = await withRetry(() => base44.asServiceRole.entities[entityName].filter(filter, '-created_date', batchSize));
        if (!records?.length) break;
        for (const record of records) {
          await withRetry(() => base44.asServiceRole.entities[entityName].delete(record.id));
          total += 1;
          await sleep(80);
        }
        if (records.length < batchSize) break;
        await sleep(250);
      }
      return total;
    };

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

    results.notifications += await deleteByFilter('Notification', { user_email: targetEmail });
    results.clientNotes += await deleteByFilter('ClientNote', { client_email: targetEmail });
    results.supportTickets += await deleteByFilter('SupportTicket', { client_email: targetEmail });
    results.consolidationRequests += await deleteByFilter('ConsolidationRequest', { client_email: targetEmail });
    results.packages += await deleteByFilter('Package', { client_email: targetEmail });
    results.invoices += await deleteByFilter('Invoice', { client_email: targetEmail });
    results.emailLogs += await deleteByFilter('EmailLog', { recipient_email: targetEmail });
    results.emailLogs += await deleteByFilter('EmailLog', { sender_email: targetEmail });

    const clientConsolidations = await withRetry(() => base44.asServiceRole.entities.Consolidation.filter({ client_email: targetEmail }, '-created_date', 100));
    for (const consolidation of clientConsolidations) {
      const accountsPayable = await base44.asServiceRole.entities.AccountsPayable.filter({ related_consolidation_id: consolidation.id }, '-created_date', 500);
      for (const ap of accountsPayable) {
        const apLedgers = await withRetry(() => base44.asServiceRole.entities.AccountsPayableLedger.filter({ ap_id: ap.id }, '-created_date', 100));
        for (const ledger of apLedgers) {
          await withRetry(() => base44.asServiceRole.entities.AccountsPayableLedger.delete(ledger.id));
          await sleep(80);
          results.apLedgers += 1;
        }

        const providerPayments = await withRetry(() => base44.asServiceRole.entities.ProviderPayment.filter({ provider_name: ap.vendor_name }, '-created_date', 100));
        for (const providerPayment of providerPayments) {
          const allocations = Array.isArray(providerPayment.allocations) ? providerPayment.allocations : [];
          if (!allocations.some((allocation) => allocation.ap_id === ap.id)) continue;

          const reference = providerPayment.reference || `PP:${providerPayment.id}`;
          const providerLedgers = await withRetry(() => base44.asServiceRole.entities.ProviderPaymentLedger.filter({
            provider_name: providerPayment.provider_name,
            transaction_type: 'pago',
            reference,
          }, '-created_date', 100));

          for (const providerLedger of providerLedgers) {
            await withRetry(() => base44.asServiceRole.entities.ProviderPaymentLedger.delete(providerLedger.id));
            await sleep(80);
            results.providerPaymentLedgers += 1;
          }

          await withRetry(() => base44.asServiceRole.entities.ProviderPayment.delete(providerPayment.id));
          await sleep(80);
          results.providerPayments += 1;
        }

        await withRetry(() => base44.asServiceRole.entities.AccountsPayable.delete(ap.id));
        await sleep(80);
        results.accountsPayable += 1;
      }

      await withRetry(() => base44.asServiceRole.entities.Consolidation.delete(consolidation.id));
      await sleep(80);
      results.consolidations += 1;
    }

    await withRetry(() => base44.asServiceRole.entities.User.delete(targetUserId));
    results.userDeleted = true;

    return Response.json({ success: true, email: targetEmail, results });
  } catch (error) {
    console.error('deleteMyAccount error:', error);
    return Response.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
});