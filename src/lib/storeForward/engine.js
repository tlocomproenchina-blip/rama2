import { get, getAll, put, del } from '@/lib/offlineDb';
import { processReviewQueue } from '@/lib/reviewQueue';
import { flushPendingScanLogs } from '@/lib/scanLogs';
import { HANDLERS, kindOf } from './handlers';
import { backoffMs, classifyError, errorMessage } from './errors';

// Store and Forward de la bodega. Todo evento se guarda primero en el teléfono
// (IndexedDB) y la pantalla sigue; aquí se reenvía en orden cuando hay red.
// - Un solo envío a la vez entre pestañas (Web Locks), así nada sale dos veces.
// - Cada evento lleva un id estable que el servidor usa para no repetirlo.
// - Nada se borra del teléfono hasta que el servidor lo confirma (acuse).
// - Lo que el servidor rechaza queda apartado como "Requiere revisión".

const LOCK = 'tlec-store-forward';
const RETRY_MS = 20000;
const MAX_LOGIC_ATTEMPTS = 8;
const ACK_DAYS = 7;

const listeners = new Set();
const events = new Map();
const isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false);
let state = { syncing: false, online: isOnline(), persisted: null };
let running = false;
let rerun = false;
let started = false;
let seqCounter = 0;

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(LOCK) : null;
function notify(local = true) {
  listeners.forEach((fn) => fn());
  if (local) channel?.postMessage('change');
}
if (channel) channel.onmessage = () => notify(false);
const setState = (patch) => { state = { ...state, ...patch }; notify(false); };

export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const getState = () => state;

export function on(name, fn) {
  if (!events.has(name)) events.set(name, new Set());
  events.get(name).add(fn);
  return () => events.get(name)?.delete(fn);
}
function emit(name, data) {
  const set = events.get(name);
  set?.forEach((fn) => { try { fn(data); } catch (_) { /* pantalla cerrada */ } });
  return set?.size || 0;
}

function deviceId() {
  try { return localStorage.getItem('tlec_warehouse_device_id') || ''; } catch (_) { return ''; }
}
const newId = (prefix) => `${prefix}_${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`}`;
const nextSeq = () => Date.now() * 1000 + (seqCounter++ % 1000);
const bySeq = (a, b) => (a.seq || a.created_at * 1000 || 0) - (b.seq || b.created_at * 1000 || 0);

export async function listQueue() {
  return (await getAll('sync_queue').catch(() => [])).sort(bySeq);
}
export async function listAcks() {
  return (await getAll('sync_acks').catch(() => [])).sort((a, b) => b.acked_at - a.acked_at);
}

// Guarda el evento en el teléfono. Solo cuando esto termina la pantalla lo da por aceptado.
export async function enqueue(item) {
  const id = item.id || newId(item.queue_type || item.type || 'evt');
  const existing = await get('sync_queue', id).catch(() => null);
  const { image_base64, ...rest } = item;
  const record = {
    ...rest,
    id,
    event_id: id,
    seq: existing?.seq || nextSeq(),
    rev: (existing?.rev || 0) + 1,
    created_at: existing?.created_at || item.created_at || Date.now(),
    device_created_at: existing?.device_created_at || new Date().toISOString(),
    device_id: rest.device_id || deviceId(),
    attempts: 0,
    next_attempt_at: 0,
    error_message: '',
    sync_status: 'pending',
  };
  if (image_base64) {
    await put('sync_blobs', { id, data: image_base64 });
    record.blob_ref = id;
  }
  await put('sync_queue', record);
  notify();
  kick();
  return record;
}

async function ack(item, result = 'ok', message = '') {
  const latest = await get('sync_queue', item.id).catch(() => null);
  // Si el evento se volvió a guardar mientras viajaba, se envía de nuevo la versión nueva.
  if (latest && latest.rev && item.rev && latest.rev !== item.rev) {
    await put('sync_queue', { ...latest, sync_status: 'pending' });
    return;
  }
  await put('sync_acks', {
    id: item.id,
    kind: kindOf(item),
    label: item.label_code || item.tracking || item.tracking_number || item.operation || '',
    result,
    message,
    device_created_at: item.device_created_at || '',
    acked_at: Date.now(),
  }).catch(() => {});
  await del('sync_queue', item.id);
  if (item.blob_ref) await del('sync_blobs', item.blob_ref).catch(() => null);
}

const ctxFor = (item) => ({
  emit,
  save: async (next) => {
    const { image_base64, ...r } = next;
    await put('sync_queue', { ...r, sync_status: 'syncing' });
  },
  dropQueued: (other, result) => ack(other, result),
});

async function runOnce() {
  const queue = await listQueue();
  // Con el candado tomado, lo que figure "enviando" quedó de una sesión cortada.
  for (const q of queue) {
    if (q.sync_status === 'syncing') await put('sync_queue', { ...q, sync_status: 'pending' });
  }
  const queued = new Set(queue.map((q) => q.id));
  for (const original of queue) {
    if (!isOnline()) break;
    const item = (await get('sync_queue', original.id).catch(() => null));
    if (!item || item.sync_status === 'conflict') continue;
    if ((item.next_attempt_at || 0) > Date.now()) continue;
    if ((item.depends_on || []).some((d) => d !== item.id && queued.has(d))) continue;
    const handler = HANDLERS[kindOf(item)];
    if (!handler) continue;

    await put('sync_queue', { ...item, sync_status: 'syncing' });
    notify();
    try {
      let full = item;
      if (item.blob_ref) {
        const blob = await get('sync_blobs', item.blob_ref).catch(() => null);
        if (blob) full = { ...item, image_base64: blob.data };
      }
      const out = (await handler(full, ctxFor(item))) || {};
      await ack(item, out.result || 'ok', out.message || '');
      queued.delete(item.id);
    } catch (e) {
      const latest = (await get('sync_queue', item.id).catch(() => null)) || item;
      const attempts = (latest.attempts || 0) + 1;
      const kind = classifyError(e);
      const conflict = kind === 'client' || (kind === 'logic' && attempts >= MAX_LOGIC_ATTEMPTS);
      await put('sync_queue', {
        ...latest,
        sync_status: conflict ? 'conflict' : 'error',
        error_message: errorMessage(e),
        attempts,
        last_attempt_at: Date.now(),
        next_attempt_at: conflict ? 0 : Date.now() + backoffMs(attempts),
      });
      if (kind === 'network') break;
    } finally {
      notify();
    }
  }
}

export function kick() {
  if (!isOnline()) return;
  processReviewQueue();
  flushPendingScanLogs().catch(() => {});
  if (running) { rerun = true; return; }
  running = true;
  setState({ syncing: true });
  const exec = async () => {
    do { rerun = false; await runOnce(); } while (rerun && isOnline());
  };
  const job = typeof navigator !== 'undefined' && navigator.locks?.request
    ? navigator.locks.request(LOCK, { ifAvailable: true }, (lock) => (lock ? exec() : null))
    : exec();
  Promise.resolve(job).catch(() => {}).finally(() => {
    running = false;
    setState({ syncing: false });
  });
}

async function updateMany(match, patch) {
  for (const q of await listQueue()) {
    if (match(q)) await put('sync_queue', { ...q, ...patch });
  }
  notify();
  kick();
}

export const retryItem = (id) => updateMany((q) => q.id === id, { sync_status: 'pending', next_attempt_at: 0, attempts: 0 });
export const retryAll = (match = () => true) => updateMany(
  (q) => match(q) && q.sync_status !== 'syncing',
  { sync_status: 'pending', next_attempt_at: 0 },
);

// Descartar es explícito (lo pide el operador) y queda registrado en los acuses.
export async function discardItem(id) {
  const item = await get('sync_queue', id).catch(() => null);
  if (item) await ack(item, 'discarded', item.error_message || '');
  notify();
}

async function pruneAcks() {
  const limit = Date.now() - ACK_DAYS * 86400000;
  for (const a of await listAcks()) {
    if (a.acked_at < limit) await del('sync_acks', a.id).catch(() => null);
  }
}

export function startStoreForward() {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('online', () => { setState({ online: true }); kick(); });
  window.addEventListener('offline', () => setState({ online: false }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
  setInterval(kick, RETRY_MS);
  // Pide a Android que no borre estos datos cuando le falte espacio.
  navigator.storage?.persist?.().then((persisted) => setState({ persisted })).catch(() => {});
  pruneAcks().catch(() => {});
  kick();
}