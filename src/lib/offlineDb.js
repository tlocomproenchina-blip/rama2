// Wrapper liviano sobre IndexedDB para el flujo offline-first de WarehouseScanPack.
// Almacena: clients, packages, bultos (abiertos y cerrados), bulto_number_blocks, sync_queue.
// No usa localStorage para datos grandes (solo para flags y device_id).

const DB_NAME = 'tlec_warehouse_offline';
const DB_VERSION = 1;
const STORES = ['clients', 'packages', 'bultos', 'bulto_number_blocks', 'sync_queue'];

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      STORES.forEach((store) => {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'id' });
        }
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(store, mode = 'readonly') {
  const db = await openDb();
  return db.transaction(store, mode).objectStore(store);
}

export async function bulkPut(store, items) {
  const os = await tx(store, 'readwrite');
  return Promise.all(
    (items || []).map(
      (item) =>
        new Promise((resolve, reject) => {
          const r = os.put(item);
          r.onsuccess = () => resolve(item);
          r.onerror = () => reject(r.error);
        })
    )
  );
}

export async function put(store, item) {
  return bulkPut(store, [item]);
}

export async function get(store, id) {
  const os = await tx(store);
  return new Promise((resolve, reject) => {
    const r = os.get(id);
    r.onsuccess = () => resolve(r.result || null);
    r.onerror = () => reject(r.error);
  });
}

export async function getAll(store) {
  const os = await tx(store);
  return new Promise((resolve, reject) => {
    const r = os.getAll();
    r.onsuccess = () => resolve(r.result || []);
    r.onerror = () => reject(r.error);
  });
}

export async function del(store, id) {
  const os = await tx(store, 'readwrite');
  return new Promise((resolve, reject) => {
    const r = os.delete(id);
    r.onsuccess = () => resolve(true);
    r.onerror = () => reject(r.error);
  });
}

export async function clearStore(store) {
  const os = await tx(store, 'readwrite');
  return new Promise((resolve, reject) => {
    const r = os.clear();
    r.onsuccess = () => resolve(true);
    r.onerror = () => reject(r.error);
  });
}

export async function count(store) {
  const os = await tx(store);
  return new Promise((resolve, reject) => {
    const r = os.count();
    r.onsuccess = () => resolve(r.result || 0);
    r.onerror = () => reject(r.error);
  });
}

// --- Búsquedas locales optimizadas (sin índices, filtros en memoria) ---

// Busca paquete por label_code (coincidencia exacta, case-insensitive)
export async function findPackageByLabelCode(labelCode) {
  if (!labelCode) return null;
  const all = await getAll('packages');
  const lc = String(labelCode).trim().toLowerCase();
  return all.find((p) => String(p.label_code || '').trim().toLowerCase() === lc) || null;
}

// Busca paquete por tracking_number con lógica de sub-tracking (remover sufijos)
export async function findPackageByTracking(tracking) {
  if (!tracking) return null;
  const all = await getAll('packages');
  const t = String(tracking).trim();
  // Coincidencia exacta primero
  let pkg = all.find((p) => (p.tracking_number || '').trim() === t);
  if (pkg) return pkg;
  // Sub-tracking: remover sufijos numéricos del final
  const removalOrder = [3, 2, 4, 1, 5, 6];
  for (const remove of removalOrder) {
    const candidate = t.length - remove >= 5 ? t.slice(0, t.length - remove) : null;
    if (!candidate) continue;
    pkg = all.find((p) => (p.tracking_number || '').trim() === candidate);
    if (pkg) return pkg;
  }
  return null;
}

// Busca cliente por email (coincidencia exacta, case-insensitive)
export async function findClientByEmail(email) {
  if (!email) return null;
  const all = await getAll('clients');
  const e = String(email).trim().toLowerCase();
  return all.find((c) => String(c.email || '').trim().toLowerCase() === e) || null;
}

// Busca clientes por texto parcial (shipping_mark, email, nombre, cédula, whatsapp)
export async function searchClientsLocal(query) {
  const all = await getAll('clients');
  const q = String(query || '').trim().toLowerCase();
  if (q.length < 2) return [];
  return all
    .filter((c) => {
      const sm = String(c.shipping_mark || '').toLowerCase();
      const email = String(c.email || '').toLowerCase();
      const name = String(c.full_name || '').toLowerCase();
      const cedula = String(c.cedula || '').toLowerCase();
      const whatsapp = String(c.whatsapp || '').toLowerCase();
      return (
        sm.includes(q) ||
        email.includes(q) ||
        name.includes(q) ||
        cedula.includes(q) ||
        whatsapp.includes(q)
      );
    })
    .slice(0, 20);
}

// --- Gestión de bloques de números de bulto ---

export async function getActiveBlock() {
  const all = await getAll('bulto_number_blocks');
  return all.find((b) => b.status === 'active') || null;
}

export async function saveBlock(block) {
  return put('bulto_number_blocks', block);
}

// Reserva el siguiente número del bloque activo. Devuelve el número o null si se agotó.
export async function reserveBultoNumber() {
  const block = await getActiveBlock();
  if (!block) return null;
  if (block.next_number > block.end) return null;
  const num = block.next_number;
  block.next_number = num + 1;
  if (block.next_number > block.end) {
    block.status = 'exhausted';
  }
  await saveBlock(block);
  return num;
}

// Cuántos números quedan en el bloque activo
export async function remainingInBlock() {
  const block = await getActiveBlock();
  if (!block || block.status !== 'active') return 0;
  return Math.max(0, block.end - block.next_number + 1);
}