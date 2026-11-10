import { enqueueBytes } from '@/lib/printQueueApi';

// Bandeja local de impresiones: el trabajo se guarda en el dispositivo ANTES de enviarlo
// y solo se borra cuando el servidor confirma que quedó registrado en la cola compartida.
const DB = 'tlec-print-outbox';
const STORE = 'jobs';
let dbPromise = null;
const open = () => dbPromise || (dbPromise = new Promise((resolve, reject) => {
  const req = indexedDB.open(DB, 1);
  req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'clientKey' });
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
}));
const tx = async (mode, fn) => {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(r?.result);
    t.onerror = () => reject(t.error);
  });
};

const listeners = new Set();
export const onOutboxChanged = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const changed = () => listeners.forEach((fn) => fn());

export const listOutbox = () => tx('readonly', (s) => s.getAll()).then((r) => r || []);
const save = (item) => tx('readwrite', (s) => s.put(item)).then(changed);
const remove = (key) => tx('readwrite', (s) => s.delete(key)).then(changed);

// Intenta registrar un trabajo guardado. Devuelve el trabajo del servidor o null.
const sendOne = async (item) => {
  try {
    const job = await enqueueBytes(new Uint8Array(item.bytes), item);
    if (!job?.id) throw new Error('Sin confirmación del servidor');
    await remove(item.clientKey);
    return job;
  } catch (e) {
    await save({ ...item, attempts: (item.attempts || 0) + 1, lastError: e?.message || 'Sin conexión', lastTry: Date.now() });
    return null;
  }
};

// Guarda y envía. La misma clave nunca crea dos trabajos (el servidor deduplica).
export const submitViaOutbox = async (bytes, meta) => {
  const item = { ...meta, bytes: Array.from(bytes), createdAt: Date.now(), attempts: 0 };
  await save(item);
  return sendOne(item);
};

let flushing = false;
export const flushOutbox = async () => {
  if (flushing || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
  flushing = true;
  try {
    for (const item of await listOutbox()) await sendOne(item);
  } finally { flushing = false; }
};

export const retryOutboxItem = (item) => sendOne(item);
export const discardOutboxItem = (item) => remove(item.clientKey);

let started = false;
export const startOutboxFlusher = () => {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('online', () => flushOutbox());
  setInterval(() => flushOutbox(), 30000);
  flushOutbox();
};