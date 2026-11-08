// Trackings ya registrados en una caja o bulto (Mesa de empaque).
// Primero se revisa el caché del dispositivo (instantáneo, también sin conexión) y,
// con conexión, el servidor, que es el que tiene la última palabra.
import { base44 } from '@/api/base44Client';
import { getAll } from '@/lib/offlineDb';

const text = (v) => String(v ?? '').trim();
const up = (v) => text(v).toUpperCase();
const codesOf = (u) => [...(u?.package_trackings || []), ...(u?.unregistered_codes || [])].map(up);

const STATUS_TEXT = {
  abierta: 'en armado',
  activo: 'en armado',
  cerrado: 'cerrado',
  en_almacen_ve: 'en almacén',
  despachado: 'despachado',
};

function toOwner(unit, code, current) {
  const open = unit.status === 'activo' && !unit.closed_at;
  return {
    code,
    label_code: text(unit.label_code),
    is_caja: !!unit.is_caja,
    status: open ? 'abierta' : text(unit.status),
    source: open ? 'abierta' : 'registrada',
    operator: text(unit.created_by),
    current,
  };
}

export async function findLocalTrackingOwner({ code, packageId = '', activeUnit = null }) {
  const key = up(code);
  if (!key) return null;
  const matches = (u) =>
    u && text(u.status) !== 'desarmado' &&
    (codesOf(u).includes(key) || (packageId && (u.package_ids || []).includes(packageId)));
  if (matches(activeUnit)) return toOwner(activeUnit, code, true);
  const all = await getAll('bultos').catch(() => []);
  const hit = all.find(matches);
  return hit ? toOwner(hit, code, hit.id === activeUnit?.id) : null;
}

// ownUnitIds: borradores propios abiertos; su estado local manda (pudo quitarse un
// paquete que el servidor todavía no sabe).
export async function findServerTrackingOwner({ code, packageId = '', ownUnitIds = [] }) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return null;
  try {
    const res = await base44.functions.invoke('checkTrackingDuplicate', { code, package_id: packageId });
    const owner = res?.data?.duplicate;
    if (!owner) return null;
    if (owner.source === 'abierta' && ownUnitIds.includes(owner.unit_id)) return null;
    return owner;
  } catch (_) {
    return null;
  }
}

export function describeOwner(owner) {
  if (!owner) return '';
  if (owner.current) return `ya está dentro de ${owner.is_caja ? 'esta caja' : 'este bulto'} (${owner.label_code})`;
  const kind = owner.is_caja ? 'la caja' : 'el bulto';
  const status = STATUS_TEXT[owner.status] || owner.status || 'registrado';
  const who = owner.source === 'abierta' && owner.operator ? `, que arma ${owner.operator}` : '';
  return `ya está en ${kind} ${owner.label_code} (${status}${who})`;
}