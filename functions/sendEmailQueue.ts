import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const payload = await req.json().catch(() => ({}));
    const messages = Array.isArray(payload.messages) ? payload.messages : [];
    if (messages.length === 0) {
      return Response.json({ error: 'No messages provided' }, { status: 400 });
    }

    // Normalize and prepare rows
    const nowIso = new Date().toISOString();
    const rows = messages.map((m) => ({
      recipient_email: m.to,
      subject: String(m.subject || ''),
      body: String(m.body || ''),
      from_name: m.from_name || null,
      status: 'pending',
      attempts: 0,
      scheduled_at: m.scheduled_at || nowIso,
      priority: Number(m.priority ?? 0),
      source: m.source || 'campaign',
      campaign_id: m.campaign_id || null,
      campaign_name: m.campaign_name || null,
    })).filter(r => r.recipient_email && r.subject && r.body);

    if (rows.length === 0) {
      return Response.json({ error: 'All messages invalid' }, { status: 400 });
    }

    // Chunk bulk create to avoid payload limits
    const chunkSize = 200;
    let created = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const res = await base44.asServiceRole.entities.EmailQueue.bulkCreate(chunk);
      created += Array.isArray(res) ? res.length : (res?.length || chunk.length);
    }

    return Response.json({ enqueued: created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});