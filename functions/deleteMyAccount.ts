import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json().catch(() => ({}));
    if (payload?.confirmation !== 'ELIMINAR') {
      return Response.json({ error: 'Confirmation required' }, { status: 400 });
    }

    const targetEmail = user.email;
    const targetUserId = user.id;

    const deleteByFilter = async (entityName, filter, batchSize = 200) => {
      let total = 0;
      while (true) {
        const rows = await base44.asServiceRole.entities[entityName].filter(filter, '-created_date', batchSize);
        if (!rows?.length) break;
        for (const row of rows) {
          await base44.asServiceRole.entities[entityName].delete(row.id);
          total += 1;
        }
        if (rows.length < batchSize) break;
      }
      return total;
    };

    const clientConsolidations = await base44.asServiceRole.entities.Consolidation.filter({ client_email: targetEmail }, '-created_date', 500);

    await deleteByFilter('Notification', { user_email: targetEmail });
    await deleteByFilter('ClientNote', { client_email: targetEmail });
    await deleteByFilter('SupportTicket', { client_email: targetEmail });
    await deleteByFilter('ConsolidationRequest', { client_email: targetEmail });
    await deleteByFilter('Package', { client_email: targetEmail });
    await deleteByFilter('Invoice', { client_email: targetEmail });
    await deleteByFilter('EmailLog', { recipient_email: targetEmail });
    await deleteByFilter('EmailLog', { sender_email: targetEmail });

    for (const consolidation of clientConsolidations || []) {
      const aps = await base44.asServiceRole.entities.AccountsPayable.filter({ related_consolidation_id: consolidation.id }, '-created_date', 200);
      for (const ap of aps || []) {
        await deleteByFilter('AccountsPayableLedger', { ap_id: ap.id });
        await base44.asServiceRole.entities.AccountsPayable.delete(ap.id);
      }
    }

    await deleteByFilter('Consolidation', { client_email: targetEmail });
    await base44.asServiceRole.entities.User.delete(targetUserId);

    return Response.json({ success: true });
  } catch (error) {
    console.error('deleteMyAccount error:', error);
    return Response.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
});