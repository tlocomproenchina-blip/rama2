import { getPrintDeviceId, isStationEnabled } from '@/lib/printDevice';
import { withPrinterLock } from '@/lib/printLock';
import { enqueueBytes, fetchStation, getCachedStation, waitForJob } from '@/lib/printQueueApi';

const withTimeout = (promise, ms) => Promise.race([
  promise,
  new Promise((resolve) => setTimeout(() => resolve(undefined), ms)),
]);

// Consulta la estación en segundo plano para que el toque de "Imprimir" no espere.
export const prefetchStation = () => { fetchStation().catch(() => {}); };

// Hay otra estación activa y este teléfono tiene conexión: el trabajo va a la cola.
const shouldUseSharedQueue = async () => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  if (isStationEnabled()) return false;
  let station = getCachedStation();
  if (station === undefined) station = await withTimeout(fetchStation().catch(() => null), 2500);
  return !!(station?.alive && station.device_id && station.device_id !== getPrintDeviceId());
};

const newKey = () => `job_${getPrintDeviceId()}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// Punto único de impresión Bluetooth. Si otro teléfono es la estación, el trabajo entra
// en la cola compartida y se espera a que salga; si no (sin estación, sin conexión o este
// teléfono es la estación), se imprime directo aquí, un trabajo a la vez.
// direct(bytes, onProgress): conecta y escribe en la impresora de este teléfono.
// dedupeKey: identifica el contenido; si ese mismo trabajo sigue en espera no se repite.
export const sendToPrinter = async ({ bytes, title, labelCount = 0, source = '', dedupeKey = '', direct, onProgress, onQueued }) => {
  if (await shouldUseSharedQueue()) {
    let job = null;
    try {
      const clientKey = dedupeKey ? `job_${getPrintDeviceId()}_${dedupeKey}`.slice(0, 500) : newKey();
      job = await enqueueBytes(bytes, { title, labelCount, source, clientKey });
    } catch (_) {
      job = null; // sin cola disponible: se intenta directo
    }
    if (job) {
      onQueued?.(job);
      await waitForJob(job.id);
      onProgress?.(bytes.length, bytes.length);
      return { via: 'station' };
    }
  }
  await withPrinterLock(() => direct(bytes, onProgress));
  return { via: 'direct' };
};