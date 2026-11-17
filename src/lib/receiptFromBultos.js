import { base44 } from '@/components/api/ApiQueueManager';

const clean = (v) => String(v || '').trim();
const up = (v) => clean(v).toUpperCase();
import { num } from '@/lib/numbers';

export const bultoTrackings = (b) => [...new Set((b.package_trackings || []).map(up).filter(Boolean))];
export const bultoCbm = (b) => num(b.cargo_cbm);
export const bultoPackages = (b) => num(b.cargo_package_count) || (b.package_ids || []).length || bultoTrackings(b).length;

// Bulto en almacén que no pertenece a ningún recibo ni factura del cliente.
export function isOrphanBulto(b, receiptCodes, receiptTrackings) {
  if (b.status === 'despachado' || b.billing_marked || b.billed_invoice_id || clean(b.invoice_number)) return false;
  if ((b.cbm_order_numbers || []).some((o) => receiptCodes.has(up(o)))) return false;
  if (bultoTrackings(b).some((t) => receiptTrackings.has(t))) return false;
  return true;
}

export async function loadClientReceiptIndex(email) {
  const receipts = await base44.entities.CbmIngreso.filter({ client_email: email }, '-fecha', 500);
  return {
    codes: new Set(receipts.map((r) => up(r.invoice_number)).filter(Boolean)),
    trackings: new Set(receipts.flatMap((r) => (r.tracking_numbers || []).map(up)).filter(Boolean)),
  };
}

// Valores precargados desde los bultos seleccionados (sin sumar dos veces un tracking).
export function prefillFromBultos(bultos) {
  const orders = [...new Set(bultos.flatMap((b) => (b.cbm_order_numbers || []).map(clean)).filter(Boolean))];
  const trackings = [...new Set(bultos.flatMap(bultoTrackings))];
  const dates = bultos.map((b) => b.ve_recognized_date || b.created_date).filter(Boolean).sort();
  return {
    invoice_number: orders.length === 1 ? orders[0] : '',
    cbm: Math.round(bultos.reduce((s, b) => s + bultoCbm(b), 0) * 10000) / 10000,
    trackings,
    package_count: bultos.reduce((s, b) => s + bultoPackages(b), 0),
    fecha: dates[0] || new Date().toISOString(),
  };
}

// Recibos existentes del cliente a los que se pueden asignar bultos.
export async function loadClientReceipts(email) {
  return base44.entities.CbmIngreso.filter({ client_email: email }, '-fecha', 200);
}

// Vincula los bultos a un recibo ya creado (sin crear otro). Suma sus trackings
// y paquetes nuevos al recibo; no cambia su CBM.
export async function assignBultosToReceipt({ client, bultoIds, receiptId }) {
  const [fresh, index, receipts] = await Promise.all([
    base44.entities.Bulto.filter({ id: { $in: bultoIds } }, '-created_date', bultoIds.length + 5),
    loadClientReceiptIndex(client.email),
    base44.entities.CbmIngreso.filter({ id: receiptId }, '-fecha', 1),
  ]);
  const receipt = receipts[0];
  if (!receipt || receipt.client_email !== client.email) throw new Error('El recibo seleccionado ya no existe.');
  const stillOrphan = fresh.filter((b) => b.client_email === client.email && isOrphanBulto(b, index.codes, index.trackings));
  if (stillOrphan.length !== bultoIds.length) throw new Error('Algunos bultos ya quedaron vinculados a un recibo o factura. Los datos cambiaron, revisa la lista.');

  const code = clean(receipt.invoice_number);
  const pre = prefillFromBultos(stillOrphan);
  const current = (receipt.tracking_numbers || []).map(up);
  const added = pre.trackings.filter((t) => !current.includes(t));
  await base44.entities.CbmIngreso.update(receipt.id, {
    tracking_numbers: [...(receipt.tracking_numbers || []), ...added],
    package_count: num(receipt.package_count) + pre.package_count || undefined,
    notas: [clean(receipt.notas), `Bultos asignados: ${stillOrphan.map((b) => b.label_code).filter(Boolean).join(', ')}`].filter(Boolean).join(' · '),
  });
  await Promise.all(stillOrphan.map((b) => base44.entities.Bulto.update(b.id, {
    cbm_order_numbers: [...new Set([...(b.cbm_order_numbers || []), code])],
  })));
  return receipt;
}

// Revalida al confirmar, crea el recibo y vincula los bultos con su N° de contenedor.
export async function createReceiptFromBultos({ client, bultoIds, invoiceNumber, cbm }) {
  const code = clean(invoiceNumber);
  if (!code) throw new Error('Falta el N° de contenedor.');
  if (!(num(cbm) > 0)) throw new Error('Falta el CBM.');

  const [fresh, index] = await Promise.all([
    base44.entities.Bulto.filter({ id: { $in: bultoIds } }, '-created_date', bultoIds.length + 5),
    loadClientReceiptIndex(client.email),
  ]);
  if (index.codes.has(up(code))) throw new Error(`El cliente ya tiene un recibo ${code}. Usa otro N° de contenedor.`);
  const stillOrphan = fresh.filter((b) => b.client_email === client.email && isOrphanBulto(b, index.codes, index.trackings));
  if (stillOrphan.length !== bultoIds.length) throw new Error('Algunos bultos ya quedaron vinculados a un recibo o factura. Los datos cambiaron, revisa la lista.');

  const pre = prefillFromBultos(stillOrphan);
  const fecha = new Date(pre.fecha).toISOString();
  const receipt = await base44.entities.CbmIngreso.create({
    fecha,
    mes: fecha.slice(0, 7),
    cbm: num(cbm),
    invoice_number: code,
    client_email: client.email,
    client_name: client.full_name || '',
    shipping_mark: client.shipping_mark || '',
    tracking_numbers: pre.trackings,
    package_count: pre.package_count || undefined,
    proveedor: 'Bultos en almacén',
    notas: `Creado desde bultos: ${stillOrphan.map((b) => b.label_code).filter(Boolean).join(', ')}`,
    billed: false,
  });
  await Promise.all(stillOrphan.map((b) => base44.entities.Bulto.update(b.id, {
    cbm_order_numbers: [...new Set([...(b.cbm_order_numbers || []), code])],
  })));
  return receipt;
}