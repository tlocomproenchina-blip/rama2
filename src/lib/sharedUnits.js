// Cajas y bultos en armado de cada operador de la Mesa de empaque, guardados en línea.
//
// Cada cambio se guarda primero en el dispositivo (IndexedDB) y se anota aquí como
// "lo agregado y lo quitado" por campo. Con conexión se envía enseguida; sin conexión
// espera en localStorage y sale al reconectar. El operador recupera sus unidades abiertas
// en cualquier dispositivo; las de otros operadores no se mezclan con las suyas.
import { base44 } from '@/api/base44Client';
import { get, put, del, findPackageByTracking } from '@/lib/offlineDb';

export const LIST_FIELDS = [
  'package_ids', 'package_trackings', 'unregistered_codes',
  'absorbed_codes', 'combined_codes', 'cbm_order_numbers',
];
const QUEUE_KEY = 'tlec_shared_unit_ops';
const text = (v) => String(v ?? '').trim();
const uniq = (list) => [...new Set((Array.isArray(list) ? list : []).map(text).filter(Boolean))];

export const isSharedUnit = (unit) => String(unit?.id || '').startsWith('local_');
const isOpenLocal = (unit) => unit && unit.status === 'activo' && !unit.closed_at;

export function readQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '{}') || {}; } catch (_) { return {}; }
}
function writeQueue(queue) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)); } catch (_) {}
}
export const pendingCount = () => Object.keys(readQueue()).length;

const hasAny = (map) => Object.values(map).some((list) => list.length);

function diffUnit(prev, next) {
  const added = {};
  const removed = {};
  for (const f of LIST_FIELDS) {
    const before = uniq(prev?.[f]);
    const after = uniq(next?.[f]);
    added[f] = after.filter((x) => !before.includes(x));
    removed[f] = before.filter((x) => !after.includes(x));
  }
  return { added, removed };
}

// Anota el cambio de la unidad (prev → next). status: abierta | cerrada | eliminada.
export function queueUnitChange(prev, next, status = 'abierta') {
  if (!isSharedUnit(next)) return false;
  const queue = readQueue();
  const entry = queue[next.id] || { added: {}, removed: {} };
  const { added, removed } = diffUnit(prev, next);
  if (status === 'abierta' && prev && !queue[next.id] && !hasAny(added) && !hasAny(removed)) return false;
  for (const f of LIST_FIELDS) {
    entry.added[f] = uniq([...(entry.added[f] || []).filter((x) => !removed[f].includes(x)), ...added[f]]);
    entry.removed[f] = uniq([...(entry.removed[f] || []).filter((x) => !added[f].includes(x)), ...removed[f]]);
  }
  entry.unit = next;
  entry.status = status;
  entry.version = (entry.version || 0) + 1;
  queue[next.id] = entry;
  writeQueue(queue);
  return true;
}

const toPayload = (unit) => ({
  unit_id: unit.id,
  label_code: unit.label_code,
  is_caja: !!unit.is_caja,
  client_email: unit.client_email,
  shipping_mark: unit.shipping_mark,
  bulto_number: unit.bulto_number,
  total_bultos: unit.total_bultos,
  client_snapshot: unit.client_snapshot || {},
  absorbed_bultos: unit.absorbed_bultos || [],
  created_by: unit.created_by || '',
  ...Object.fromEntries(LIST_FIELDS.map((f) => [f, uniq(unit[f])])),
});

const fromRecord = (record) => ({
  id: record.unit_id,
  local_bulto_id: record.unit_id,
  label_code: record.label_code,
  is_caja: !!record.is_caja,
  client_email: record.client_email || '',
  shipping_mark: record.shipping_mark || '',
  bulto_number: record.bulto_number,
  total_bultos: record.total_bultos,
  client_snapshot: record.client_snapshot || {},
  created_by: record.created_by_email || '',
  status: 'activo',
  is_local: true,
  shared_updated_by: record.updated_by || '',
});

// Aplica en el dispositivo el estado compartido de una unidad, uniendo lo local que el
// servidor todavía no tiene. Devuelve null si no cambió nada.
export async function applyRemoteUnit(record) {
  const id = text(record?.unit_id);
  if (!id) return null;
  const local = await get('bultos', id).catch(() => null);
  const pending = readQueue()[id];
  if (pending && pending.status !== 'abierta') return null;

  if (record.status !== 'abierta') {
    if (isOpenLocal(local)) {
      await del('bultos', id).catch(() => null);
      return { changed: true };
    }
    return null;
  }
  if (local && !isOpenLocal(local)) return null;

  const tombstones = record.tombstones || {};
  const merged = { invoice_paid: false, invoice_status: '', invoice_number: '', warehouse_id: '', ...(local || {}), ...fromRecord(record) };
  const server = {};
  let needsPush = false;
  for (const f of LIST_FIELDS) {
    server[f] = uniq(record[f]);
    const pendingAdded = pending?.added?.[f] || [];
    const pendingRemoved = pending?.removed?.[f] || [];
    const gone = new Set(uniq(tombstones[f]).filter((x) => !pendingAdded.includes(x)));
    merged[f] = uniq([...server[f], ...uniq(local?.[f])])
      .filter((x) => !gone.has(x) && !pendingRemoved.includes(x));
    if (merged[f].some((x) => !server[f].includes(x))) needsPush = true;
  }
  const absorbed = new Set(merged.absorbed_codes);
  const byCode = new Map();
  for (const b of [...(record.absorbed_bultos || []), ...(local?.absorbed_bultos || [])]) {
    const code = text(b?.label_code);
    if (code && absorbed.has(code) && !byCode.has(code)) byCode.set(code, b);
  }
  merged.absorbed_bultos = [...byCode.values()];

  await put('bultos', merged);
  if (needsPush) queueUnitChange({ ...merged, ...server }, merged);
  return { changed: true, needsPush };
}

// Quita del borrador local los trackings que el servidor rechazó por estar en otra unidad.
async function stripRejected(id, rejected) {
  const local = await get('bultos', id).catch(() => null);
  if (!local) return;
  const codes = new Set(rejected.map((o) => text(o.code).toUpperCase()));
  const ids = new Set();
  for (const code of codes) {
    const pkg = await findPackageByTracking(code).catch(() => null);
    if (pkg?.id) ids.add(pkg.id);
  }
  const keep = (x) => !codes.has(text(x).toUpperCase());
  await put('bultos', {
    ...local,
    package_trackings: (local.package_trackings || []).filter(keep),
    unregistered_codes: (local.unregistered_codes || []).filter(keep),
    package_ids: (local.package_ids || []).filter((x) => !ids.has(x)),
  });
}

// Envía los cambios anotados. Se detiene en el primer fallo (sin conexión).
// Devuelve si cambió algo y los trackings rechazados por duplicados.
export async function flushQueue(deviceId) {
  const queue = readQueue();
  let changed = false;
  const rejected = [];
  for (const [id, entry] of Object.entries(queue)) {
    const res = await base44.functions.invoke('syncOpenPackUnit', {
      unit: toPayload(entry.unit),
      added: entry.added,
      removed: entry.removed,
      status: entry.status,
      device_id: deviceId,
    });
    const current = readQueue();
    if (current[id]?.version === entry.version) {
      delete current[id];
      writeQueue(current);
    }
    const lost = res?.data?.rejected || [];
    if (lost.length) {
      await stripRejected(id, lost);
      rejected.push(...lost);
      changed = true;
    }
    const record = res?.data?.record;
    if (record && entry.status === 'abierta') {
      if (await applyRemoteUnit(record)) changed = true;
    }
  }
  return { changed, rejected };
}

// Unidades abiertas del operador que hoy están en el servidor.
export async function fetchOpenShared(owner) {
  const res = await base44.entities.OpenPackUnit.filter({ status: 'abierta', created_by_email: owner }, '-updated_date', 200);
  return Array.isArray(res) ? res : res?.items || [];
}