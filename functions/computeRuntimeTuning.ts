import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function percentile(arr, p) {
  if (!arr.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  const idx = Math.floor((p / 100) * (a.length - 1));
  return a[idx];
}

function avg(arr) { return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0; }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Leer últimas métricas (recientes)
    const recent = await base44.asServiceRole.entities.RuntimeMetrics.list('-created_date', 200);
    const now = Date.now();
    const windowMs = 60_000; // 60s
    const metrics = (recent || []).filter(m => now - new Date(m.created_date).getTime() <= windowMs);

    const q = metrics.map(m => Number(m.queue_length) || 0);
    const wA = metrics.map(m => Number(m.active_writes) || 0);
    const rA = metrics.map(m => Number(m.active_reads) || 0);
    const fails = metrics.map(m => Number(m.failure_count) || 0);

    const p95Queue = percentile(q, 95);
    const avgWrites = avg(wA);
    const avgReads = avg(rA);
    const p90Fails = percentile(fails, 90);

    // Heurística de tuning
    let target = {
      max_reads: 24,
      max_writes: 8,
      min_interval_ms: 60,
      backoff_delays: [500, 1000, 2000, 4000, 8000],
      circuit_breaker_threshold: 12,
      circuit_open_minutes: 1,
      ui_degradation_mode: 'off',
      reason: 'baseline'
    };

    if (p95Queue > 120 || avgWrites > 10) {
      target = {
        ...target,
        max_reads: 48,
        max_writes: 16,
        min_interval_ms: 30,
        circuit_breaker_threshold: 20,
        ui_degradation_mode: p90Fails > 5 ? 'light' : 'off',
        reason: 'elevated_load'
      };
    }

    if (p95Queue > 300 || avgWrites > 14) {
      target = {
        ...target,
        max_reads: 64,
        max_writes: 24,
        min_interval_ms: 20,
        circuit_breaker_threshold: 30,
        ui_degradation_mode: p90Fails > 8 ? 'aggressive' : 'light',
        reason: 'extreme_load'
      };
    }

    if (p95Queue < 10 && avgWrites < 3 && avgReads < 8) {
      target = {
        ...target,
        max_reads: 16,
        max_writes: 6,
        min_interval_ms: 80,
        circuit_breaker_threshold: 8,
        ui_degradation_mode: 'off',
        reason: 'low_load'
      };
    }

    // Upsert RuntimeTuning (config_key = 'global') con protección de frecuencia
    const existing = await base44.asServiceRole.entities.RuntimeTuning.filter({ config_key: 'global' }, '-created_date', 1);
    const lastUpdated = existing?.[0]?.updated_date ? new Date(existing[0].updated_date).getTime() : 0;
    if (Date.now() - lastUpdated < 45_000) {
      return Response.json({ status: 'skipped', reason: 'throttled_recent_update', metrics_count: metrics.length });
    }
    const record = {
      config_key: 'global',
      ...target,
      updated_by: (await base44.auth.me())?.email || 'system'
    };

    if (existing && existing.length > 0) {
      await base44.asServiceRole.entities.RuntimeTuning.update(existing[0].id, record);
    } else {
      await base44.asServiceRole.entities.RuntimeTuning.create(record);
    }

    return Response.json({ status: 'ok', metrics_count: metrics.length, p95Queue, avgWrites, target });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});