// Vincula una etiqueta de envío (ShippingLabel, ej. N4-TLEC-5401-L2) con el
// tracking del paquete. Etiqueta y tracking identifican la MISMA carga, así que
// nunca se deja un segundo paquete: si el almacén recibió la caja por la
// etiqueta y el cliente tenía el tracking pre-alertado aparte, ambos registros
// se unifican en uno solo.

const text = (v: any) => String(v ?? '').trim();
const up = (v: any) => text(v).toUpperCase();

export class LinkError extends Error {
  status: number;
  constructor(message: string, status = 409) {
    super(message);
    this.status = status;
  }
}

// Paquete creado por el almacén al escanear la etiqueta: su tracking es el
// mismo código de la etiqueta hasta que el cliente asigna el tracking real.
export const hasRealTracking = (pkg: any) =>
  !!text(pkg?.tracking_number) && up(pkg?.tracking_number) !== up(pkg?.label_code);

const isReceived = (pkg: any) =>
  !!(pkg?.received_date || pkg?.warehouse_location_id || pkg?.actual_weight_kg);

async function first(entity: any, query: any) {
  const rows = await entity.filter(query, '-created_date', 1).catch(() => []);
  return rows?.[0] || null;
}

export async function findLabel(base44: any, code: string) {
  const ent = base44.asServiceRole.entities.ShippingLabel;
  return (await first(ent, { label_code: text(code) })) || (await first(ent, { label_code: up(code) }));
}

async function findByLabelCode(base44: any, code: string) {
  const ent = base44.asServiceRole.entities.Package;
  return (await first(ent, { label_code: text(code) })) || (await first(ent, { label_code: up(code) }));
}

async function inBulto(base44: any, pkgId: string) {
  const b = await first(base44.asServiceRole.entities.Bulto, { package_ids: pkgId });
  return !!b;
}

// Une `other` dentro de `keeper`: completa lo que falte y borra `other`.
async function mergeInto(base44: any, keeper: any, other: any) {
  const fill: any = {};
  const copy = [
    'shipping_company', 'invoice_url', 'product_image_url', 'seller_delivery_date',
    'seller_delivery_photo_uri', 'package_image_url', 'warehouse_id', 'warehouse_name',
    'warehouse_city', 'warehouse_country', 'warehouse_location_id', 'warehouse_location_code',
    'warehouse_location_name', 'warehouse_zone', 'actual_weight_kg', 'actual_length_cm',
    'actual_width_cm', 'actual_height_cm', 'actual_cbm', 'received_date', 'received_by',
  ];
  for (const f of copy) {
    if ((keeper[f] === null || keeper[f] === undefined || keeper[f] === '') && other[f]) fill[f] = other[f];
  }
  if (!(keeper.package_image_urls || []).length && (other.package_image_urls || []).length) {
    fill.package_image_urls = other.package_image_urls;
  }
  if (other.has_insurance && !keeper.has_insurance) {
    fill.has_insurance = true;
    fill.fob_value = other.fob_value || keeper.fob_value || 0;
  }
  const genericDesc = !text(keeper.description) || /hu[ée]rfano|por etiqueta/i.test(keeper.description);
  if (genericDesc && text(other.description)) fill.description = other.description;

  const payments = await base44.asServiceRole.entities.InsurancePayment
    .filter({ package_id: other.id }, '-created_date', 50).catch(() => []);
  for (const p of payments || []) {
    await base44.asServiceRole.entities.InsurancePayment.update(p.id, { package_id: keeper.id }).catch(() => null);
  }
  await base44.asServiceRole.entities.Package.delete(other.id);
  return fill;
}

// Vincula etiqueta ↔ tracking para el cliente. Devuelve el paquete único.
export async function linkLabelTracking(base44: any, { user, labelCode, tracking }: any) {
  const code = text(labelCode);
  const trk = text(tracking);
  const label = await findLabel(base44, code);
  if (!label || text(label.client_email).toLowerCase() !== text(user.email).toLowerCase()) {
    throw new LinkError('La etiqueta no existe en tu cuenta', 404);
  }
  const Package = base44.asServiceRole.entities.Package;

  let byLabel = await findByLabelCode(base44, label.label_code);
  if (!byLabel && label.linked_package_id) {
    byLabel = await first(Package, { id: label.linked_package_id });
  }
  const byTracking = trk ? await first(Package, { tracking_number: trk }) : null;

  if (byTracking) {
    const owner = text(byTracking.client_email).toLowerCase();
    if (!byTracking.is_orphan && owner && owner !== text(user.email).toLowerCase()) {
      throw new LinkError('Este tracking ya está registrado en otra cuenta');
    }
    if (text(byTracking.label_code) && up(byTracking.label_code) !== up(label.label_code)) {
      throw new LinkError(`Este tracking ya está vinculado a la etiqueta ${byTracking.label_code}`);
    }
  }
  if (byLabel && trk && hasRealTracking(byLabel) && up(byLabel.tracking_number) !== up(trk)) {
    throw new LinkError(`Esta etiqueta ya tiene asignado el tracking ${byLabel.tracking_number}`);
  }

  let keeper = byLabel || byTracking;
  let merged = false;
  let fill: any = {};
  if (byLabel && byTracking && byLabel.id !== byTracking.id) {
    const [labelInBulto, trackingInBulto] = await Promise.all([inBulto(base44, byLabel.id), inBulto(base44, byTracking.id)]);
    if (labelInBulto && trackingInBulto) {
      throw new LinkError('La etiqueta y el tracking ya están empacados por separado. Contacta a soporte para unificarlos.');
    }
    let other;
    if (trackingInBulto) { keeper = byTracking; other = byLabel; }
    else if (labelInBulto) { keeper = byLabel; other = byTracking; }
    else if (isReceived(byTracking) && !isReceived(byLabel)) { keeper = byTracking; other = byLabel; }
    else { keeper = byLabel; other = byTracking; }
    fill = await mergeInto(base44, keeper, other);
    merged = true;
  }

  let pkg;
  if (keeper) {
    const received = isReceived(keeper) || !!fill.received_date;
    pkg = await Package.update(keeper.id, {
      ...fill,
      ...(trk ? { tracking_number: trk } : {}),
      label_code: label.label_code,
      client_email: user.email,
      shipping_mark: user.shipping_mark || keeper.shipping_mark || label.shipping_mark,
      is_orphan: false,
      reported: true,
      ...(keeper.is_orphan || (merged && received && keeper.status === 'pre_alerta')
        ? { status: received ? 'recibido' : 'pre_alerta' } : {}),
    });
  } else {
    if (!trk) throw new LinkError('Indica el tracking', 400);
    pkg = await Package.create({
      tracking_number: trk,
      label_code: label.label_code,
      client_email: user.email,
      shipping_mark: user.shipping_mark || label.shipping_mark,
      shipping_type: 'maritimo',
      risk_category: label.has_battery || label.has_liquid || label.has_powder || label.has_fbrand ? 'alto_riesgo' : 'general',
      package_count: Number(label.box_count) || 1,
      description: text(label.content) || 'Pre-alerta por etiqueta',
      status: 'pre_alerta',
      reported: true,
    });
  }

  await base44.asServiceRole.entities.ShippingLabel.update(label.id, {
    linked_package_id: pkg.id,
    status: hasRealTracking(pkg) ? 'vinculada' : 'disponible',
  });
  return { package: pkg, merged, label };
}

// Recepción por etiqueta: devuelve el paquete de esa etiqueta o, si el cliente
// aún no pre-alertó, crea uno solo a su nombre (tracking = código de etiqueta).
export async function packageForReceptionLabel(base44: any, code: string) {
  const existing = await findByLabelCode(base44, code);
  if (existing) return { package: existing, created: false };
  const label = await findLabel(base44, code);
  if (!label) return { package: null, created: false };
  if (label.linked_package_id) {
    const linked = await first(base44.asServiceRole.entities.Package, { id: label.linked_package_id });
    if (linked) return { package: linked, created: false };
  }
  const pkg = await base44.asServiceRole.entities.Package.create({
    tracking_number: label.label_code,
    label_code: label.label_code,
    client_email: label.client_email,
    shipping_mark: label.shipping_mark,
    shipping_type: 'maritimo',
    risk_category: label.has_battery || label.has_liquid || label.has_powder || label.has_fbrand ? 'alto_riesgo' : 'general',
    package_count: Number(label.box_count) || 1,
    description: text(label.content) || 'Paquete por etiqueta (sin tracking aún)',
    status: 'pre_alerta',
  });
  await base44.asServiceRole.entities.ShippingLabel.update(label.id, { linked_package_id: pkg.id, status: 'disponible' });
  return { package: pkg, created: true };
}