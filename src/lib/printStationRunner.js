import { base44 } from '@/api/base44Client';
import { connectAuthorizedPrinter } from '@/lib/bluetoothReconnect';
import { ensurePrinterConnected, isPrinterConnected, writePayload } from '@/lib/thermalPrinter';
import { isStationEnabled, setStationEnabled } from '@/lib/printDevice';
import { withPrinterLock } from '@/lib/printLock';
import { claimNextJob, completeJob, failJob, releaseStation, sendHeartbeat } from '@/lib/printQueueApi';

// Estación de impresión: este teléfono mantiene la impresora conectada, reserva los
// trabajos de la cola compartida de uno en uno, los imprime y los marca como impresos.
const HEARTBEAT_MS = 20000;
const POLL_MS = 15000;
const PRINTER_OFF = 'Impresora desconectada: los trabajos esperan en la cola. Toca "Reconectar impresora".';

let state = { running: false, current: null, error: '', printed: 0 };
const listeners = new Set();
const emit = (patch) => { state = { ...state, ...patch }; listeners.forEach((fn) => fn(state)); };
export const getStationState = () => state;
export const onStationState = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

let hbTimer = null;
let pollTimer = null;
let unsub = null;
let processing = false;
let again = false;

const decode = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const isNotStation = (e) => e?.response?.data?.error === 'not_station';

const printerReady = async () => isPrinterConnected() || !!(await connectAuthorizedPrinter().catch(() => null));

const processJob = async ({ job, payload_b64 }) => {
  emit({ current: job });
  try {
    await withPrinterLock(async () => {
      await ensurePrinterConnected();
      await writePayload(decode(payload_b64));
    });
    await completeJob(job.id, job.claim_token);
    emit({ printed: state.printed + 1, error: '' });
  } catch (e) {
    const msg = e?.message || 'Error Bluetooth';
    await failJob(job.id, job.claim_token, msg).catch(() => {});
    emit({ error: `Falló "${job.title || 'trabajo'}": ${msg}` });
  } finally {
    emit({ current: null });
  }
};

const kick = async () => {
  if (!state.running) return;
  if (processing) { again = true; return; }
  processing = true;
  try {
    while (state.running) {
      if (!(await printerReady())) { emit({ error: PRINTER_OFF }); break; }
      if (state.error === PRINTER_OFF) emit({ error: '' });
      const res = await claimNextJob();
      if (!res?.job) { if (res?.retry) continue; break; }
      await processJob(res);
    }
  } catch (e) {
    if (isNotStation(e)) stopLocal('Otro teléfono tomó la estación de impresión.');
  } finally {
    processing = false;
    if (again) { again = false; kick(); }
  }
};

const beat = async () => {
  try {
    const res = await sendHeartbeat(false);
    if (res && !res.ok) stopLocal(`${res.station?.operator_name || 'Otro operador'} tomó la estación de impresión.`);
  } catch (_) {}
};

const run = () => {
  if (state.running) return;
  emit({ running: true, error: '' });
  hbTimer = setInterval(beat, HEARTBEAT_MS);
  pollTimer = setInterval(kick, POLL_MS);
  try {
    unsub = base44.entities.PrintJob.subscribe((ev) => {
      if (ev?.type === 'create' || ev?.data?.status === 'pending') kick();
    });
  } catch (_) {}
  kick();
};

function stopLocal(reason = '') {
  clearInterval(hbTimer);
  clearInterval(pollTimer);
  try { unsub?.(); } catch (_) {}
  unsub = null;
  setStationEnabled(false);
  emit({ running: false, current: null, error: reason });
}

// Desde el toque del operador: conecta la impresora y toma la estación.
export const startStation = async ({ pick = false } = {}) => {
  await ensurePrinterConnected({ pick });
  const res = await sendHeartbeat(true);
  if (!res?.ok) throw new Error('No se pudo tomar la estación de impresión');
  setStationEnabled(true);
  if (state.running) kick();
  else run();
};

export const stopStation = async () => {
  stopLocal('');
  await releaseStation().catch(() => {});
};

// Al abrir la app: si este teléfono era la estación y nadie la tomó, sigue siéndolo.
export const resumeStationIfEnabled = async () => {
  if (!isStationEnabled() || state.running) return;
  const res = await sendHeartbeat(false).catch(() => null);
  if (res?.ok) run();
  else if (res) setStationEnabled(false);
};