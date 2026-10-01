// Armado de la caja consolidada en el dispositivo.
//
// El almacén abre una caja (código propio {shipping_mark}-C##), mete dentro los bultos
// pequeños y los paquetes sueltos, y al cerrarla se sincroniza: el servidor absorbe los
// bultos (los elimina y deja constancia) y la caja queda como la unidad que se despacha.
// Mientras se arma, todo se resuelve contra el caché del dispositivo para que el trabajo
// no se detenga si la conexión falla.
import { getAll, put, del, findPackageByLabelCode, findPackageByTracking } from '@/lib/offlineDb';
import { buildCajaCode, isCajaCode } from '@/lib/cajaCodes';

const text = (value) => String(value ?? '').trim();
const uniq = (list) => [...new Set((list || []).map(text).filter(Boolean))];

export async function loadLocalBultos() {
  return getAll('bultos').catch(() => []);
}

// Cliente dueño del shipping mark del código (el caché trae todos los clientes).
export async function findLocalClientByMark(markRaw) {
  const mark = text(markRaw).toLowerCase();
  if (!mark) return null;
  const clients = await getAll('clients').catch(() => []);
  return clients.find((c) => text(c.shipping_mark).toLowerCase() === mark) || null;
}

export async function findLocalBultoByCode(code) {
  const value = text(code).toLowerCase();
  if (!value) return null;
  const bultos = await loadLocalBultos();
  return bultos.find((b) => text(b.label_code).toLowerCase() === value) || null;
}

// Paquete del caché por etiqueta TLEC o por tracking (con sub-tracking).
export async function findLocalPackage(code) {
  const value = text(code);
  if (!value) return null;
  const byLabel = await findPackageByLabelCode(value).catch(() => null);
  if (byLabel) return byLabel;
  return findPackageByTracking(value).catch(() => null);
}

// CBM de un paquete: el volumen real medido en el almacén.
const cbmOfPackage = (pkg) => Number(pkg?.actual_cbm) || 0;

// Conteo y CBM reales de lo que va dentro de la caja.
export async function cajaContents(caja) {
  const ids = (caja?.package_ids || []).filter(Boolean);
  const packages = await getAll('packages').catch(() => []);
  const inside = ids.map((id) => packages.find((p) => p.id === id)).filter(Boolean);
  return {
    package_count: ids.length + (caja?.unregistered_codes || []).length,
    cbm: Number(inside.reduce((sum, p) => sum + cbmOfPackage(p), 0).toFixed(4)),
    orders: caja?.cbm_order_numbers || [],
  };
}

// Caja vacía lista para armar. Nace en el dispositivo (is_local) y se sincroniza al
// cerrarla, igual que los bultos del almacén.
export async function createLocalCaja({ client, number, user }) {
  const shippingMark = text(client?.shipping_mark);
  const labelCode = buildCajaCode(shippingMark, number);
  const caja = {
    id: `local_caja_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    local_bulto_id: `local_caja_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    label_code: labelCode,
    is_caja: true,
    client_email: text(client?.email),
    shipping_mark: shippingMark,
    bulto_number: number,
    total_bultos: number,
    package_ids: [],
    package_trackings: [],
    unregistered_codes: [],
    cbm_order_numbers: [],
    absorbed_bultos: [],
    absorbed_codes: [],
    client_snapshot: {
      full_name: client?.full_name || '',
      email: client?.email || '',
      cedula: client?.cedula || '',
      whatsapp: client?.whatsapp || '',
      address: client?.address || '',
      city: client?.city || '',
      state: client?.state || '',
      shipping_mark: shippingMark,
    },
    status: 'activo',
    is_local: true,
    created_by: user?.email || '',
    created_at: new Date().toISOString(),
  };
  await put('bultos', caja);
  return caja;
}

// Mete un bulto pequeño dentro de la caja: aporta sus paquetes, sus códigos sin
// registrar y su N° de orden. El bulto se elimina cuando la caja se sincroniza.
export async function absorbBultoIntoLocalCaja(caja, source) {
  if (!caja || !source) return caja;
  if (text(source.label_code) === text(caja.label_code)) return caja;
  if (source.is_caja) return caja;

  const updated = {
    ...caja,
    package_ids: uniq([...(caja.package_ids || []), ...(source.package_ids || [])]),
    package_trackings: uniq([
      ...(caja.package_trackings || []),
      ...(source.package_trackings || []),
    ]),
    unregistered_codes: uniq([
      ...(caja.unregistered_codes || []),
      ...(source.unregistered_codes || []),
    ]),
    cbm_order_numbers: uniq([...(caja.cbm_order_numbers || []), ...(source.cbm_order_numbers || [])]),
    absorbed_codes: uniq([...(caja.absorbed_codes || []), source.label_code]),
    absorbed_bultos: [
      ...(caja.absorbed_bultos || []),
      {
        label_code: text(source.label_code),
        bulto_number: Number(source.bulto_number) || 0,
        package_count:
          (source.package_ids || []).length + (source.unregistered_codes || []).length,
        order_numbers: source.cbm_order_numbers || [],
        status: text(source.status),
        printed: Number(source.print_count) > 0,
        trackings: uniq(source.package_trackings || []),
        absorbed_at: new Date().toISOString(),
      },
    ],
  };
  await put('bultos', updated);
  return updated;
}

// Mete un paquete suelto (o un código sin registrar) dentro de la caja.
export async function addPackageToLocalCaja(caja, { pkg = null, code = '' }) {
  if (!caja) return caja;
  const scanned = text(pkg?.tracking_number || code);
  const updated = pkg
    ? {
        ...caja,
        package_ids: uniq([...(caja.package_ids || []), pkg.id]),
        package_trackings: uniq([...(caja.package_trackings || []), scanned]),
      }
    : {
        ...caja,
        unregistered_codes: uniq([...(caja.unregistered_codes || []), scanned]),
        package_trackings: uniq([...(caja.package_trackings || []), scanned]),
      };
  await put('bultos', updated);
  return updated;
}

export async function saveLocalCaja(caja) {
  if (!caja?.id) return caja;
  await put('bultos', caja);
  return caja;
}

// Cajas del cliente que todavía no salieron del almacén, de la más antigua a la más nueva.
export async function localCajasOfClient(clientEmail, { clientSideOnly = false } = {}) {
  const email = text(clientEmail).toLowerCase();
  if (!email) return [];
  const bultos = await loadLocalBultos();
  return bultos
    .filter((b) => b.is_caja && text(b.client_email).toLowerCase() === email)
    .filter((b) => text(b.status) !== 'despachado')
    .filter((b) => !clientSideOnly || b.is_local)
    .sort((a, b) => (Number(a.bulto_number) || 0) - (Number(b.bulto_number) || 0));
}

export async function dropLocalBulto(id) {
  if (!id) return;
  await del('bultos', id).catch(() => null);
}

export { isCajaCode };