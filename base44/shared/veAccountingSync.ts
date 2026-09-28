// Sincronización Almacén Venezuela → Contabilidad (Ingresos de CBM).
//
// El almacén de Venezuela es la fuente definitiva a la hora de facturar: el N° de
// orden, el CBM del bulto y su conteo real de paquetes se copian al recibo de
// contabilidad (CbmIngreso). El recibo vinculado se corrige —no se duplica— y si
// ningún recibo corresponde al bulto se crea uno nuevo para que contabilidad no
// tenga que capturarlo a mano.
//
// La sincronización es de un solo sentido: lo que se edite en Ingresos de CBM no
// se escribe de vuelta en el bulto.
//
// Se reutiliza desde assignBultoOrderNumbers, createBultoFromScan, updateBulto y
// la corrida de conciliación (syncBultosToAccounting).
import { fetchAllFilter, num, normTracking } from "./paginatedFetch.ts";

const text = (v: any) => String(v ?? "").trim();
const lower = (v: any) => text(v).toLowerCase();
const round5 = (v: number) => Math.round(v * 1e5) / 1e5;

// CBM definitivo del bulto: el registrado por el almacén de Venezuela o, si todavía
// no lo registró, la suma del volumen real de sus paquetes.
export async function bultoCbm(base44: any, bulto: any) {
  const registered = num(bulto?.cargo_cbm);
  if (registered > 0) return round5(registered);
  const ids = (bulto?.package_ids || []).filter((id: any) => id && !String(id).startsWith("local_"));
  if (!ids.length) return 0;
  const pkgs = await Promise.all(
    ids.map((id: string) => base44.asServiceRole.entities.Package.get(id).catch(() => null))
  );
  return round5(pkgs.reduce((sum: number, p: any) => sum + num(p?.actual_cbm), 0));
}

// Conteo real de paquetes del bulto: el corregido a mano en almacén manda; si no,
// los paquetes agrupados más los códigos sin registrar.
export function bultoPackageCount(bulto: any) {
  const registered = num(bulto?.cargo_package_count);
  if (registered > 0) return Math.round(registered);
  const grouped = (bulto?.package_ids || []).length + (bulto?.unregistered_codes || []).length;
  return grouped > 0 ? grouped : (bulto?.package_trackings || []).length;
}

// Alinea el recibo de contabilidad del bulto con lo registrado en el almacén de
// Venezuela. Devuelve { action: 'updated' | 'created' | 'skipped', warnings }.
// options.previous_orders: N° de orden que tenía el bulto antes del cambio, para
// poder encontrar el recibo vinculado cuando el número se corrige.
export async function syncBultoToAccounting(base44: any, bulto: any, options: any = {}) {
  const warnings: string[] = [];
  const empty = { action: "skipped", warnings };

  const email = text(bulto?.client_email);
  const orders = [...new Set((bulto?.cbm_order_numbers || []).map(text).filter(Boolean))];
  const previousOrders = [...new Set((options.previous_orders || []).map(text).filter(Boolean))];
  const trackings = [...new Set((bulto?.package_trackings || []).map(normTracking).filter(Boolean))];

  if (!bulto?.id || !email || (!orders.length && !previousOrders.length && !trackings.length)) return empty;

  const actor = text(options.actor) || text(bulto.ve_recognized_by) || text(bulto.order_assigned_by) || "Almacén Venezuela";
  const now = new Date().toISOString();
  const label = text(bulto.label_code);

  const receipts = await fetchAllFilter(
    base44.asServiceRole.entities.CbmIngreso, { client_email: email }, "-fecha"
  );

  // 1) Recibo vinculado por los trackings del bulto (el que más coincidencias tenga).
  let target: any = null;
  let hits = 0;
  for (const r of receipts) {
    const count = (r.tracking_numbers || [])
      .map(normTracking)
      .filter((t: string) => t && trackings.includes(t)).length;
    if (count > hits) { hits = count; target = r; }
  }
  // 2) Respaldo: por el N° de orden actual del bulto o el que tenía antes del cambio.
  const searchOrders = [...new Set([...orders, ...previousOrders])].map(lower);
  if (!target && searchOrders.length) {
    target = receipts.find((r: any) => searchOrders.includes(lower(r.invoice_number))) || null;
  }

  const cbm = await bultoCbm(base44, bulto);
  const packageCount = bultoPackageCount(bulto);
  const orderForReceipt = orders[0] || text(target?.invoice_number);

  // El N° de orden del almacén nunca puede duplicar el de otro recibo.
  let conflict = "";
  if (orderForReceipt) {
    const dup = receipts.find((r: any) => r.id !== target?.id && lower(r.invoice_number) === lower(orderForReceipt));
    if (dup) {
      conflict = `El N° de orden ${orderForReceipt} ya está registrado en otro recibo de contabilidad (${dup.client_name || dup.client_email || "otro registro"}). Corrígelo desde Ingresos de CBM para que quede alineado.`;
      warnings.push(conflict);
    }
  }

  const syncMarks = { ve_synced_date: now, ve_synced_by: actor, ve_synced_bulto_label: label };

  // El CBM y el conteo del almacén mandan solo si el recibo es el registro de este
  // bulto (cubre sus mismos paquetes). Si incluye carga de otros bultos, se conservan
  // sus valores para no alterar lo que contabilidad ya tiene registrado.
  const receiptTrackings = (target?.tracking_numbers || []).map(normTracking).filter(Boolean);
  const receiptCovered = receiptTrackings.length === 0 || receiptTrackings.every((t: string) => trackings.includes(t));

  // Recibo existente: se corrige el mismo registro.
  if (target) {
    const updates: any = {};
    if (!target.billed && receiptCovered) {
      if (cbm > 0 && cbm !== num(target.cbm)) updates.cbm = cbm;
      if (packageCount > 0 && packageCount !== num(target.package_count)) updates.package_count = packageCount;
    } else if (!receiptCovered && num(bulto.cargo_cbm) > 0) {
      warnings.push(`El recibo ${text(target.invoice_number) || "vinculado"} cubre más paquetes que este bulto: se conservó su CBM y su conteo. Registra el bulto con su propio N° de orden para facturarlo aparte.`);
    }
    if (!conflict && orderForReceipt && text(target.invoice_number) !== orderForReceipt) {
      updates.invoice_number = orderForReceipt;
    }

    // Nada que corregir: el recibo ya está alineado con el almacén.
    if (!Object.keys(updates).length) return { action: "matched", receipt_id: target.id, warnings };

    await base44.asServiceRole.entities.CbmIngreso.update(target.id, { ...updates, ...syncMarks });
    return { action: "updated", receipt_id: target.id, warnings };
  }

  // Sin recibo vinculado: se crea uno nuevo con lo que registró el almacén.
  if (cbm <= 0 && !orderForReceipt) return empty;

  const notes = [`Registrado desde el almacén de Venezuela (bulto ${label || bulto.id}).`];
  if (orders.length > 1) notes.push(`N° de orden del bulto: ${orders.join(", ")}.`);
  if (cbm <= 0) notes.push("CBM pendiente de registrar en almacén.");

  const created = await base44.asServiceRole.entities.CbmIngreso.create({
    fecha: now,
    mes: now.slice(0, 7),
    cbm: cbm > 0 ? cbm : 0,
    package_count: packageCount,
    invoice_number: conflict ? "" : (orderForReceipt || ""),
    client_email: email,
    client_name: text(bulto.client_snapshot?.full_name),
    shipping_mark: text(bulto.client_snapshot?.shipping_mark) || text(bulto.shipping_mark),
    tracking_numbers: trackings,
    proveedor: "Almacén Venezuela",
    descripcion: label ? `Bulto ${label}` : "Bulto del almacén Venezuela",
    notas: notes.join(" "),
    ...syncMarks,
  });

  return { action: "created", receipt_id: created.id, warnings };
}