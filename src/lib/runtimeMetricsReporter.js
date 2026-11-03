// Etapa 0 del plan de rendimiento: envía cada 5 minutos la medición de la cola
// de llamadas (por página) a RuntimeMetrics. Solo para administradores y solo
// si hubo actividad. Usa el cliente directo para no medirse a sí mismo.
import { base44 as rawClient } from '@/api/base44Client';
import { takeApiMetrics, getApiStatus, flushCreditLogs } from '@/components/api/ApiQueueManager';

const INTERVAL_MS = 5 * 60 * 1000;
const MIN_WINDOW_MS = 60 * 1000;
let started = false;
let lastFlushAt = Date.now();

async function flush(user) {
  if (Date.now() - lastFlushAt < MIN_WINDOW_MS) return;
  lastFlushAt = Date.now();
  const rows = takeApiMetrics();
  if (!rows.length) return;
  const status = getApiStatus();
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
  const records = rows.map((r) => ({
    ...r,
    client_email: user?.email || '',
    role: user?.custom_role || user?.role || '',
    queue_length: status.queueLength,
    active_reads: status.activeReads,
    active_writes: status.activeWrites,
    max_reads: status.maxReads,
    max_writes: status.maxWrites,
    failure_count: status.failureCount,
    circuit_state: status.circuitBreakerState,
    cache_size: status.cacheSize,
    inflight_size: status.inflightSize,
    device_cores: navigator?.hardwareConcurrency || 0,
    is_mobile: isMobile,
  }));
  try {
    await rawClient.entities.RuntimeMetrics.bulkCreate(records);
  } catch (_) { /* la medición nunca debe afectar el trabajo del usuario */ }
}

export function startRuntimeMetricsReporter(user) {
  if (started || typeof window === 'undefined' || user?.role !== 'admin') return;
  started = true;
  lastFlushAt = Date.now();
  setInterval(() => flush(user), INTERVAL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      flushCreditLogs();
      flush(user);
    }
  });
}