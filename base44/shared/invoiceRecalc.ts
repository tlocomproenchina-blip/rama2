// Recálculo de las líneas de envío de una factura.
//
// Hoy una factura guarda un solo precio por CBM prorrateado: el total de envío
// se reparte entre todo el CBM, así que un recibo de alto riesgo (sensible) y
// uno general terminan mostrando la misma tarifa unitaria. Aquí cada recibo se
// cobra con SU tarifa: la del tipo de carga que le corresponde, la vigente a la
// fecha de ESE recibo y la del estado del cliente.
//
// Reutiliza las reglas de Facturación Manual (billingRates.ts) y la lectura de
// líneas de las facturas (duplicateReceipts.ts) para no duplicar lógica.
import { num, normTracking } from "./paginatedFetch.ts";
import { rateForReceipt, round2 } from "./billingRates.ts";
import { invoiceLines, normOrder } from "./duplicateReceipts.ts";

export const CARGO_TYPE_GENERAL = "general";
export const CARGO_TYPE_HIGH_RISK = "alto_riesgo";

export function normalizeCargoType(value: any) {
  const v = String(value || "").trim().toLowerCase();
  return v === CARGO_TYPE_HIGH_RISK || v === "sensible" ? CARGO_TYPE_HIGH_RISK : CARGO_TYPE_GENERAL;
}

// Clave estable de una línea de envío: el panel la usa para fijar el tipo de
// carga de ese recibo y la vuelve a enviar al aplicar el recálculo.
export function lineKey(invoice: any, line: any) {
  const base = line?.id || line?.number || `idx${num(line?.index)}`;
  return `${invoice?.id || ""}::${base}`;
}

function indexReceipts(receipts: any[]) {
  const byId: Record<string, any> = {};
  const byTracking: Record<string, any> = {};
  const byNumber: Record<string, any> = {};
  for (const r of receipts || []) {
    if (!r) continue;
    if (r.id) byId[r.id] = r;
    for (const t of r.tracking_numbers || []) {
      const k = normTracking(t);
      if (k && !byTracking[k]) byTracking[k] = r;
    }
    const n = normOrder(r.invoice_number);
    if (n && !byNumber[n]) byNumber[n] = r;
  }
  return { byId, byTracking, byNumber };
}

// Ubica el recibo (CbmIngreso) de una línea: por vínculo, por trackings o por
// N° de contenedor. De ahí salen la fecha de tarifa y el tipo de carga.
function findReceipt(line: any, index: any) {
  if (line?.id && index.byId[line.id]) return index.byId[line.id];
  for (const k of line?.tracking_keys || []) {
    if (index.byTracking[k]) return index.byTracking[k];
  }
  const n = normOrder(line?.number);
  if (n && index.byNumber[n]) return index.byNumber[n];
  return null;
}

// Cómo queda la factura al recalcular cada envío con la tarifa de su recibo.
export function buildInvoiceRecalc({ invoice, receiptsOfClient, ctx, overrides }: any) {
  const items = Array.isArray(invoice?.items) ? invoice.items : [];
  const breakdown = invoice?.cost_breakdown || {};
  const fallbackType = normalizeCargoType(breakdown.cargo_type || CARGO_TYPE_GENERAL);
  const lines = invoiceLines(invoice);
  const index = indexReceipts(receiptsOfClient);

  const warnings: string[] = [];
  const resolved: any[] = [];
  let shippingBefore = 0;

  for (const l of lines) {
    const receipt = findReceipt(l, index);
    const cbm = num(l.cbm);
    const key = lineKey(invoice, l);
    const override = overrides?.[key];
    const type = normalizeCargoType(override || l.type || receipt?.cargo_type || fallbackType);
    const fecha = receipt?.fecha || invoice?.invoice_date || null;
    const rate = rateForReceipt(ctx, fecha, type);
    const totalBefore = num(l.item?.total);
    shippingBefore += totalBefore;

    if (!receipt) {
      warnings.push(`La línea ${l.number || `${cbm.toFixed(4)} CBM`} no tiene recibo ubicado: se usó la fecha de la factura y el tipo indicado.`);
    }
    if (cbm <= 0) {
      warnings.push(`La línea ${l.number || "sin número"} no tiene CBM registrado: no se puede recalcular su tarifa.`);
    }

    resolved.push({
      key,
      index: l.index,
      item: l.item,
      number: l.number || (receipt?.invoice_number ? String(receipt.invoice_number) : ""),
      cbm_ingreso_id: l.id || receipt?.id || null,
      cbm,
      fecha,
      type,
      type_from: override ? "manual" : (l.type ? "factura" : (receipt?.cargo_type ? "recibo" : "predeterminado")),
      rate: round2(rate),
      unit_before: num(l.item?.unit_price),
      total_before: totalBefore,
      total_after: round2(cbm * rate),
    });
  }

  const shippingAfter = round2(resolved.reduce((s: number, r: any) => s + num(r.total_after), 0));
  const delta = round2(shippingAfter - round2(shippingBefore));
  const totalBefore = num(invoice?.total);
  // El total se mueve solo por el envío: el resto de conceptos (seguro,
  // consolidación, puerta a puerta, extras) queda intacto.
  const totalAfter = round2(totalBefore + delta);
  const blocked = resolved.length === 0
    ? "La factura no tiene líneas de envío que recalcular."
    : (resolved.some((r: any) => num(r.cbm) <= 0) ? "Hay líneas de envío sin CBM registrado: revísalas a mano." : null);
  const changed = !blocked && Math.abs(delta) >= 0.01;

  const newItems = items.map((it: any, i: number) => {
    const r = resolved.find((x: any) => x.index === i);
    if (!r) return it;
    const details: any = { ...(it?.details || {}), cbm: r.cbm, cargo_type: r.type };
    if (r.number) {
      details.invoice_number = r.number;
      details.source_invoices = [r.number];
    }
    return { ...it, quantity: r.cbm, unit_price: r.rate, total: r.total_after, details };
  });

  const typeByNumber: Record<string, string> = {};
  for (const r of resolved) {
    if (r.number) typeByNumber[String(r.number)] = r.type;
  }
  const typesUsed = [...new Set(resolved.map((r: any) => r.type))];
  const flagged = num(breakdown.billed_cbm) > 0 && num(breakdown.total_cbm) > 0
    && Math.abs(num(breakdown.billed_cbm) - num(breakdown.total_cbm)) > 1e-6;
  if (flagged) {
    warnings.push("Esta factura guardaba un CBM facturado distinto al de sus recibos: el recálculo usa el CBM real de cada recibo.");
  }

  const manualRecibos = Array.isArray(invoice?.manual_recibos) && invoice.manual_recibos.length
    ? invoice.manual_recibos.map((m: any) => ({
      ...m,
      cargo_type: typeByNumber[String(m.invoice_number)] || normalizeCargoType(m.cargo_type || fallbackType),
    }))
    : null;

  const billedCbm = num(invoice?.billed_cbm) || num(breakdown.billed_cbm);
  const updates = changed ? {
    items: newItems,
    subtotal: totalAfter,
    total: totalAfter,
    ...(manualRecibos ? { manual_recibos: manualRecibos } : {}),
    cost_breakdown: {
      ...breakdown,
      shipping_total: shippingAfter,
      rate_per_cbm: billedCbm > 0 ? Number((shippingAfter / billedCbm).toFixed(4)) : num(breakdown.rate_per_cbm),
      cargo_type_per_receipt: typeByNumber,
      mixed_cargo_types: typesUsed.length > 1,
    },
  } : null;

  return {
    invoice_id: invoice?.id || null,
    before: { total: totalBefore, shipping: round2(shippingBefore) },
    after: { total: totalAfter, shipping: shippingAfter },
    delta,
    changed,
    blocked,
    flagged,
    warnings,
    lines: resolved.map((r: any) => ({
      key: r.key,
      cbm_ingreso_id: r.cbm_ingreso_id,
      number: r.number,
      cbm: r.cbm,
      fecha: r.fecha,
      type: r.type,
      type_from: r.type_from,
      rate: r.rate,
      unit_before: r.unit_before,
      total_before: r.total_before,
      total_after: r.total_after,
    })),
    types: typeByNumber,
    updates,
  };
}