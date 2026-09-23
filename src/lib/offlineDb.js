// Wrapper ligero sobre IndexedDB para el módulo de almacén offline-first.
// Stores: clients, packages, bultos, shipping_labels, sync_outbox, meta.

const DB_NAME = 'tlec_warehouse';
const DB_VERSION = 1;

export const STORES = {
  clients: 'clients',
  packages: 'packages',
  bultos: 'bultos',
  shipping_labels: 'shipping_labels',
  sync_outbox: 'sync_outbox',
  meta: 'meta',
};

let dbPromise = null;

function getDB() {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB no disponible'));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORES.clients)) {
          db.createObjectStore(STORES.clients, { keyPath: 'email' });
        }
        if (!db.objectStoreNames.contains(STORES.packages)) {
          const store = db.createObjectStore(STORES.packages, { keyPath: 'id' });
          store.createIndex('tracking_number', 'tracking_number', { unique: false });
          store.createIndex('label_code', 'label_code', { unique: false });
          store.createIndex('client_email', 'client_email', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.bultos)) {
          db.createObjectStore(STORES.bultos, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.shipping_labels)) {
          db.createObjectStore(STORES.shipping_labels, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.sync_outbox)) {
          db.createObjectStore(STORES.sync_outbox, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.meta)) {
          db.createObjectStore(STORES.meta, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

export async function getAll(store) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function put(store, value) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve(value);
    tx.onerror = () => reject(tx.error);
  });
}

export async function bulkPut(store, values) {
  if (!values?.length) return [];
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const s = tx.objectStore(store);
    values.forEach((v) => s.put(v));
    tx.oncomplete = () => resolve(values);
    tx.onerror = () => reject(tx.error);
  });
}

export async function del(store, key) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearStore(store) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getByIndex(store, indexName, value) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).index(indexName).get(value);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function getMeta(key) {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.meta, 'readonly');
      const req = tx.objectStore(STORES.meta).get(key);
      req.onsuccess = () => resolve(req.result?.value);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function setMeta(key, value) {
  try {
    return await put(STORES.meta, { key, value });
  } catch {
    return null;
  }
}

// Solicita almacenamiento persistente para que el SO no limpie IndexedDB
export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist) {
      const already = await navigator.storage.persisted?.();
      if (!already) await navigator.storage.persist();
    }
  } catch (_) {}
}