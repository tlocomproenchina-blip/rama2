import { getPrintDeviceId, isStationEnabled } from '@/lib/printDevice';
import { withPrinterLock } from '@/lib/printLock';
import { fetchStation, getCachedStation, getLastKnownStation, waitForJob } from '@/lib/printQueueApi';
import { submitViaOutbox } from '@/lib/printOutbox';
import { toast } from 'sonner';

const withTimeout = (promise, ms) => Promise.race([
  promise,
  new Promise((resolve) => setTimeout(() => resolve(undefined), ms)),
]);

// Consulta la estación en segundo plano para que el toque de "Imprimir" no espere.
export const prefetchStation = () => { fetchStation().catch(() => {}); };

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

// Otra estación es la que imprime: el trabajo va a la cola (o se guarda si no hay red).
const shouldUseSharedQueue = async () => {
  if (isStationEnabled()) return false;
  const me = getPrintDeviceId();
  if (isOffline()) {
    const last = getLastKnownStation();
    return !!(last && last.device_id !== me);
  }
  let station = getCachedStation();
  if (station === undefined) station = await withTimeout(fetchStation().catch(() => null), 2500);
  if (station === undefined || station === null) {
    const last = getLastKnownStation();
    return !!(last && last.device_id !== me);
  }
  return !!(station?.alive && station.device_id && station.device_id !== me);
};

const newKey = () => `job_${getPrintDeviceId()}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// Punto único de impresión Bluetooth. Si otro teléfono es la estación, el trabajo se guarda
// en este dispositivo y se envía a la cola compartida; si no hay conexión queda guardado y
// se reintenta solo al volver internet (nunca se pierde ni se duplica). Si este teléfono es
// la estación o no hay ninguna, se imprime directo aquí, un trabajo a la vez.
export const sendToPrinter = async ({ bytes, title, labelCount = 0, source = '', dedupeKey = '', direct, onProgress, onQueued, onSavedOffline }) => {
  if (await shouldUseSharedQueue()) {
    const clientKey = dedupeKey ? `job_${getPrintDeviceId()}_${dedupeKey}`.slice(0, 500) : newKey();
    const job = await submitViaOutbox(bytes, { title, labelCount, source, clientKey });
    if (!job) {
      toast.info('Sin conexión con la estación: la impresión quedó guardada y se enviará sola al volver internet.');
      onSavedOffline?.();
      return { via: 'outbox' };
    }
    onQueued?.(job);
    await waitForJob(job.id);
    onProgress?.(bytes.length, bytes.length);
    return { via: 'station' };
  }
  await withPrinterLock(() => direct(bytes, onProgress));
  return { via: 'direct' };
};