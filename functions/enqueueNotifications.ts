import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { kind = 'inapp', items = [], priority = 'normal', dedupeKeyPrefix } = body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return Response.json({ error: 'items required' }, { status: 400 });
    }

    // Build job records (dedupe optional)
    const now = Date.now();
    const jobs = items.map((payload, idx) => ({
      kind,
      status: 'queued',
      priority,
      attempts: 0,
      max_attempts: 5,
      next_attempt_at: new Date(now + idx * 50).toISOString(), // pequeño escalonado
      payload,
      dedupe_key: dedupeKeyPrefix ? `${dedupeKeyPrefix}:${JSON.stringify(payload).slice(0,200)}` : undefined,
    }));

    // Optional naive dedupe by existing dedupe_key
    let toInsert = jobs;
    if (dedupeKeyPrefix) {
      const existing = await base44.entities.NotificationJob.filter({ dedupe_key: dedupeKeyPrefix }, '-created_date', 1000);
      const existingSet = new Set((existing || []).map(j => j.dedupe_key));
      toInsert = jobs.filter(j => !j.dedupe_key || !existingSet.has(j.dedupe_key));
    }

    if (toInsert.length === 0) {
      return Response.json({ inserted: 0, skipped: jobs.length });
    }

    const created = await base44.entities.NotificationJob.bulkCreate(toInsert);
    return Response.json({ inserted: created.length, skipped: jobs.length - created.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});