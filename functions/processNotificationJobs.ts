import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const SLEEP = (ms) => new Promise(r => setTimeout(r, ms));

// Backoff progresivo en ms
const BACKOFFS = [5000, 10000, 20000, 40000, 80000];

// Throttle entre envíos (ms)
const THROTTLE_MS = 120; // 8-9 por segundo aprox

// Límite de jobs por ejecución
const BATCH_LIMIT = 150;

async function sendInApp(base44, job) {
  const p = job.payload || {};
  // Crea notificación in-app
  await base44.asServiceRole.entities.Notification.create({
    user_email: p.user_email,
    title: p.title,
    message: p.message,
    type: p.type || 'system',
    priority: p.priority || 'medium',
    reference_id: p.reference_id,
    entity_type: p.entity_type,
    icon: p.icon || 'bell',
  });
}

async function sendEmail(base44, job) {
  const p = job.payload || {};
  // Usa integración Core.SendEmail (asume configurado por app)
  await base44.asServiceRole.integrations.Core.SendEmail({
    to: p.to,
    subject: p.subject,
    body: p.body,
  });
}

async function processOne(base44, job) {
  // Marcar in_progress
  await base44.asServiceRole.entities.NotificationJob.update(job.id, {
    status: 'in_progress',
    attempts: (job.attempts || 0) + 1,
    error_message: null,
  });

  try {
    if (job.kind === 'inapp') {
      await sendInApp(base44, job);
    } else if (job.kind === 'email') {
      await sendEmail(base44, job);
    } else {
      throw new Error('Unsupported kind');
    }

    await base44.asServiceRole.entities.NotificationJob.update(job.id, {
      status: 'done',
      processed_at: new Date().toISOString(),
    });
  } catch (err) {
    const attempts = (job.attempts || 0) + 1;
    const max = job.max_attempts || 5;
    const backoff = BACKOFFS[Math.min(attempts - 1, BACKOFFS.length - 1)];

    await base44.asServiceRole.entities.NotificationJob.update(job.id, {
      status: attempts >= max ? 'failed' : 'queued',
      attempts,
      error_message: String(err?.message || err),
      next_attempt_at: new Date(Date.now() + backoff).toISOString(),
    });
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Sólo admins pueden disparar procesamiento manual
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const nowIso = new Date().toISOString();
    const queued = await base44.asServiceRole.entities.NotificationJob.filter({
      status: 'queued',
    }, '-priority,-created_date', BATCH_LIMIT);

    // Filtrar por next_attempt_at
    const ready = (queued || []).filter(j => !j.next_attempt_at || j.next_attempt_at <= nowIso);

    let sent = 0, failed = 0, requeued = 0;
    for (const job of ready) {
      await processOne(base44, job);
      sent++;
      await SLEEP(THROTTLE_MS);
    }

    // Estadísticas simples
    const totalQueued = (queued || []).length;
    return Response.json({ picked: ready.length, processed: sent, totalQueued, failed, requeued, throttle_ms: THROTTLE_MS });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});