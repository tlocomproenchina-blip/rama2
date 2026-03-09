import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function makeBatchId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // This is invoked by automation; no end-user auth required

    const BATCH_SIZE = 100; // tune as needed based on rate limits
    const nowIso = new Date().toISOString();

    // Pull oldest pending first
    const pending = await base44.asServiceRole.entities.EmailQueue.filter({ status: 'pending' }, 'created_date', BATCH_SIZE);
    if (!pending || pending.length === 0) {
      return Response.json({ processed: 0, sent: 0, failed: 0 });
    }

    const batchId = makeBatchId();

    // Mark as sending to avoid double-processing
    await Promise.all(pending.map((row) =>
      base44.asServiceRole.entities.EmailQueue.update(row.id, {
        status: 'sending',
        attempts: (row.attempts || 0) + 1,
        batch_id: batchId
      })
    ));

    let sent = 0, failed = 0;

    for (const row of pending) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: row.recipient_email,
          subject: row.subject,
          body: row.body,
          from_name: row.from_name || undefined,
        });

        await base44.asServiceRole.entities.EmailQueue.update(row.id, {
          status: 'sent',
          sent_date: new Date().toISOString(),
        });

        // Log email
        try {
          await base44.asServiceRole.entities.EmailLog.create({
            recipient_email: row.recipient_email,
            recipient_name: null,
            sender_email: null,
            from_name: row.from_name || undefined,
            subject: row.subject,
            body_preview: String(row.body || '').replace(/<[^>]*>/g, '').slice(0, 200),
            campaign_id: row.campaign_id || undefined,
            campaign_name: row.campaign_name || undefined,
            source: 'campaign',
            status: 'sent',
            sent_date: nowIso
          });
        } catch (_) {}
        sent++;
      } catch (err) {
        failed++;
        await base44.asServiceRole.entities.EmailQueue.update(row.id, {
          status: 'failed',
          error_message: err?.message?.slice(0, 500) || 'Unknown error',
        });
      }
      // Soft pacing to reduce 429 bursts
      await new Promise((r) => setTimeout(r, 80));
    }

    return Response.json({ processed: pending.length, sent, failed, batch_id: batchId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});