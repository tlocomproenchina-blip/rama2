import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const WINDOW_MS = 15 * 60 * 1000;
const ALERT_COOLDOWN_MS = 30 * 60 * 1000;

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

async function upsertAlert(base44, admins, alert) {
  const nowIso = new Date().toISOString();
  const existing = await base44.asServiceRole.entities.ErrorLog.filter({ fingerprint: alert.fingerprint }, '-updated_date', 1);
  const previous = existing?.[0] || null;
  const lastSeen = previous?.last_seen || previous?.updated_date || previous?.created_date;
  const shouldNotify = !lastSeen || (Date.now() - new Date(lastSeen).getTime() > ALERT_COOLDOWN_MS);

  const payload = {
    fingerprint: alert.fingerprint,
    message: alert.message,
    name: alert.name,
    severity: alert.severity,
    tag: 'runtime_monitor',
    last_seen: nowIso,
    extra: alert.extra,
  };

  if (previous) {
    await base44.asServiceRole.entities.ErrorLog.update(previous.id, {
      ...payload,
      count: Number(previous.count || 0) + 1,
    });
  } else {
    await base44.asServiceRole.entities.ErrorLog.create({
      ...payload,
      count: 1,
      first_seen: nowIso,
    });
  }

  if (!shouldNotify || !admins.length) return;

  await Promise.all(
    admins.map((email) =>
      base44.asServiceRole.entities.Notification.create({
        user_email: email,
        title: alert.title,
        message: alert.message,
        type: 'system',
        priority: alert.priority,
        icon: 'alert',
        reference_id: alert.fingerprint,
        read: false,
      })
    )
  );
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const now = Date.now();

    const [metrics, errors, users] = await Promise.all([
      base44.asServiceRole.entities.RuntimeMetrics.list('-created_date', 200),
      base44.asServiceRole.entities.ErrorLog.list('-updated_date', 100),
      base44.asServiceRole.entities.User.list('-created_date', 200),
    ]);

    const recentMetrics = (metrics || []).filter((item) => now - new Date(item.created_date).getTime() <= WINDOW_MS);
    const recentErrors = (errors || []).filter((item) => {
      const stamp = item.last_seen || item.updated_date || item.created_date;
      return stamp && now - new Date(stamp).getTime() <= WINDOW_MS;
    });
    const admins = (users || []).filter((user) => user.role === 'admin').map((user) => user.email);

    const queueAverage = average(recentMetrics.map((item) => Number(item.queue_length) || 0));
    const openCircuitCount = recentMetrics.filter((item) => item.circuit_state === 'OPEN').length;
    const failurePeak = recentMetrics.reduce((max, item) => Math.max(max, Number(item.failure_count) || 0), 0);
    const criticalErrors = recentErrors.filter((item) => item.severity === 'error');

    const alerts = [];

    if (queueAverage >= 80) {
      alerts.push({
        fingerprint: 'runtime:queue_high',
        name: 'RuntimeQueueHigh',
        title: 'Alerta de rendimiento',
        message: `La cola promedio subió a ${Math.round(queueAverage)} operaciones en los últimos 15 minutos.`,
        severity: 'warn',
        priority: 'high',
        extra: { queueAverage, sampleSize: recentMetrics.length },
      });
    }

    if (openCircuitCount >= 3 || failurePeak >= 12) {
      alerts.push({
        fingerprint: 'runtime:circuit_open',
        name: 'RuntimeCircuitOpen',
        title: 'Alerta crítica de estabilidad',
        message: `Se detectaron ${openCircuitCount} aperturas del circuit breaker y un pico de ${failurePeak} fallos recientes.`,
        severity: 'error',
        priority: 'critical',
        extra: { openCircuitCount, failurePeak, sampleSize: recentMetrics.length },
      });
    }

    if (criticalErrors.length >= 5) {
      alerts.push({
        fingerprint: 'runtime:error_spike',
        name: 'RuntimeErrorSpike',
        title: 'Pico de errores detectado',
        message: `Se registraron ${criticalErrors.length} errores recientes en la aplicación durante los últimos 15 minutos.`,
        severity: 'error',
        priority: 'critical',
        extra: { criticalErrors: criticalErrors.length },
      });
    }

    await Promise.all(alerts.map((alert) => upsertAlert(base44, admins, alert)));

    return Response.json({
      status: 'ok',
      metrics_reviewed: recentMetrics.length,
      errors_reviewed: recentErrors.length,
      alerts_created: alerts.length,
      queueAverage,
      openCircuitCount,
      failurePeak,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});