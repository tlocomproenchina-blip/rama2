// Unidades de empaque del almacén. El bulto suelto (-B##) y la caja consolidada (-C##)
// se arman en la misma mesa de trabajo: este módulo resuelve, sobre el caché del
// dispositivo, cuál es la unidad abierta que recibe el próximo escaneo y crea la que
// falte. El armado de la caja reutiliza cajaLocal (contenido, absorción y cierre).
import { getAll, put } from '@/lib/offlineDb';
import { realPackageCount } from '@/lib/bultoCounts';

const text = (value) => String(value ?? '').trim();
const uniq = (list) => [...new Set((list || []).map(text).filter(Boolean))];

export const sameClient = (a, b) =>
  !!text(a) && text(a).toLowerCase() === text(b).toLowerCase();

// Bultos y cajas que se están armando en este dispositivo.
export async function loadOpenUnits() {
  const all = await getAll('bultos').catch(() => []);
  return all.filter((b) => b.status === 'activo' && !b.closed_at);
}

// Unidad abierta del cliente del tipo pedido ('caja' | 'bulto'), si ya existe.
export async function findOpenUnit(clientEmail, kind) {
  if (!text(clientEmail)) return null;
  const wantCaja = kind === 'caja';
  const units = await loadOpenUnits();
  return (
    units.find((u) => !!u.is_caja === wantCaja && sameClient(u.client_email, clientEmail)) || null
  );
}

// Bulto suelto nuevo en el dispositivo, con el número ya reservado por el almacén.
export async function createLocalBulto({ client, number, user }) {
  const shippingMark = text(client?.shipping_mark);
  const localId = `local_bulto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const bulto = {
    id: localId,
    local_bulto_id: localId,
    label_code: `${shippingMark}-B${number}`,
    is_caja: false,
    client_email: text(client?.email),
    shipping_mark: shippingMark,
    bulto_number: number,
    total_bultos: number,
    package_ids: [],
    package_trackings: [],
    unregistered_codes: [],
    cbm_order_numbers: [],
    absorbed_bultos: [],
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
    invoice_paid: false,
    invoice_status: '',
    invoice_number: '',
    warehouse_id: '',
    status: 'activo',
    created_by: user?.email || '',
    is_local: true,
  };
  await put('bultos', bulto);
  return bulto;
}

// Mete un paquete registrado (o un código sin registrar) en la unidad abierta.
export async function addPackageToUnit(unit, { pkg = null, code = '' } = {}) {
  if (!unit) return unit;
  const scanned = text(pkg?.tracking_number || code);
  const updated = pkg
    ? {
        ...unit,
        package_ids: uniq([...(unit.package_ids || []), pkg.id]),
        package_trackings: uniq([...(unit.package_trackings || []), scanned]),
      }
    : {
        ...unit,
        unregistered_codes: uniq([...(unit.unregistered_codes || []), scanned]),
        package_trackings: uniq([...(unit.package_trackings || []), scanned]),
      };
  await put('bultos', updated);
  return updated;
}

export async function saveUnit(unit) {
  if (!unit?.id) return unit;
  await put('bultos', unit);
  return unit;
}

// Paquetes reales dentro de la unidad: sin contar las etiquetas de bultos fusionados.
export const unitPackageCount = (unit) => realPackageCount(unit);