import { base44 } from '@/api/base44Client';
import { getPrintDeviceId } from '@/lib/printDevice';

// Llamadas a la cola compartida de impresión.
const call = async (action, params = {}) => {
  const res = await base44.functions.invoke('printQueue', { action, device_id: getPrintDeviceId(), ...params });
  return res.data;
};

// Última estación conocida (para decidir rápido si se imprime directo o por la cola).
let stationCache = { value: null, at: 0 };
const remember = (station) => {
  stationCache = { value: station || null, at: Date.now() };
  try {
    if (station?.alive && station.device_id) localStorage.setItem('tlec-last-station', JSON.stringify({ device_id: station.device_id, at: Date.now() }));
  } catch (_) {}
  return station;
};

// Última estación vista viva (persistida), para decidir sin internet si el trabajo debe guardarse.
export const getLastKnownStation = (maxAgeMs = 12 * 3600 * 1000) => {
  try {
    const s = JSON.parse(localStorage.getItem('tlec-last-station') || 'null');
    return s && Date.now() - s.at < maxAgeMs ? s : null;
  } catch (_) { return null; }
};

export const fetchStation = async () => remember((await call('station'))?.station);
export const getCachedStation = (maxAgeMs = 15000) =>
  Date.now() - stationCache.at < maxAgeMs ? stationCache.value : undefined;

export const getQueueState = async () => {
  const data = await call('state');
  remember(data?.station);
  return data;
};

export const sendHeartbeat = async (force = false) => {
  const data = await call('heartbeat', { force });
  remember(data?.station);
  return data;
};
export const releaseStation = () => call('release');
export const claimNextJob = () => call('claim');
export const completeJob = (jobId, claimToken) => call('complete', { job_id: jobId, claim_token: claimToken });
export const failJob = (jobId, claimToken, error) => call('fail', { job_id: jobId, claim_token: claimToken, error });
export const retryJob = (jobId) => call('retry', { job_id: jobId });

// Aviso local para que la vista de la cola se refresque al enviar un trabajo.
const listeners = new Set();
export const onQueueChanged = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const notifyQueueChanged = () => listeners.forEach((fn) => fn());

// Sube los datos ya listos para la impresora (privados) y crea el trabajo.
export const enqueueBytes = async (bytes, { title, labelCount, source, clientKey }) => {
  const file = new File([bytes], `impresion-${Date.now()}.bin`, { type: 'application/octet-stream' });
  const up = await base44.integrations.Core.UploadPrivateFile({ file });
  const uri = up?.file_uri || up?.data?.file_uri;
  if (!uri) throw new Error('No se pudo subir el trabajo de impresión');
  const data = await call('enqueue', {
    client_key: clientKey, payload_uri: uri, payload_size: bytes.length,
    title, label_count: labelCount, source,
  });
  notifyQueueChanged();
  return data.job;
};

// Espera a que la estación imprima el trabajo (o informe que falló).
export const waitForJob = (jobId, timeoutMs = 180000) => new Promise((resolve, reject) => {
  let finished = false;
  let unsub = null;
  const finish = (fn, value) => {
    if (finished) return;
    finished = true;
    clearInterval(poll);
    clearTimeout(timer);
    try { unsub?.(); } catch (_) {}
    fn(value);
  };
  const check = (job) => {
    if (!job) return;
    if (job.status === 'done') finish(resolve, job);
    else if (job.status === 'failed') finish(reject, new Error(job.error || 'La estación no pudo imprimir'));
  };
  try {
    unsub = base44.entities.PrintJob.subscribe((ev) => { if (ev?.id === jobId) check(ev.data); });
  } catch (_) {}
  const poll = setInterval(() => { base44.entities.PrintJob.get(jobId).then(check).catch(() => {}); }, 4000);
  const timer = setTimeout(
    () => finish(reject, new Error('La estación aún no imprime este trabajo; sigue esperando en la cola compartida.')),
    timeoutMs,
  );
});