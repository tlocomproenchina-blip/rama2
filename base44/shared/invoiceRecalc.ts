// Recálculo de las tarifas de envío de una factura.
//
// Hoy una factura guarda un solo precio por CBM: el envío se reparte entre todo
// el CBM, así que un recibo de alto riesgo (sensible) y uno general terminan
// mostrando la misma tarifa unitaria. Aquí cada recibo se cobra con SU tarifa,
// según el tipo de carga que le corresponde.
//
// Reglas:
//   - El CBM de cada recibo NO se toca: se conserva el CBM facturado de la línea
//     (incluidos mínimos y ajustes) y se reparte entre los recibos de esa línea,
//     cada uno con su propio peso.
//   - El precio guardado de la factura es el punto de partida: una factura que
//     ya está bien cobrada en general no cambia. El ajuste es el recargo del
//     tipo de carga (el de las tarifas vigentes a la fecha de ESE recibo).
//   - Cuando la línea se cobró con PRECIO FIJO POR TRAMO de carga chica
//     (AppConfig.special_cbm_rates), se usa ese tramo, con su precio por tipo.
//
// Reutiliza las reglas de tarifas de Facturación Manual (billingRates.ts) y la
// lectura de líneas de las facturas (duplicateReceipts.ts).
import { num, normTracking } from "./paginatedFetch.ts";
import { rateSetForDate, ratePerCbmFor, round2, round5 } from "./billingRates.ts";
import { invoiceLines, normOrder } from "./duplicateReceipts.ts";

export const CARGO_TYPE_GENERAL = "general";
export const CARGO_TYPE_HIGH_RISK = "alto_riesgo";

export function normalizeCargoType(value: any) {
  const v = String(value || "").trim().toLowerCase();
  return v === CARGO_TYPE_HIGH_RISK || v === "sensible" ? CARGO_TYPE_HIGH_RISK : CARGO_TYPE_GENERAL;
}

// Clave estable de un recibo dentro de la factura: el panel la usa para fijar su
// tipo de carga y la vuelve a enviar al aplicar el recálculo.
export function unitKey(invoiceId: any, lineIndex: any, number: any, i: any) {
  return `${invoiceId || ""}::${num(lineIndex)}::${number || `u${i}`}`;
}

const PAIR_RE = /(\d[\d\-]*)\s*\(\s*([\d.]+)\s*CBM\s*\)/gi;

// Recibos y CBM que el detalle de una línea vieja trae entre paréntesis:
// "Envío - 125 (0.0520 CBM) + 103-1 (0.2500 CBM) = 0.4730 CBM facturado".
function parenPairs(desc: string) {
  const out: any[] = [];
  for (const m of String(desc || "").matchAll(PAIR_RE)) {
    out.push({ number: m[1], cbm: num(m[2]) });
  }
  return out;
}

// Precio fijo por tramo de CBM para cargas menores (AppConfig.special_cbm_rates).
function specialRateFor(rateSet: any, cbm: any, type: string) {
  const rates = Array.isArray(rateSet?.special_cbm_rates) ? rateSet.special_cbm_rates : [];
  const c = num(cbm);
  if (c <= 0 || !rates.length) return null;
  const sorted = [...rates].sort((a: any, b: any) => num(a.min_cbm) - num(b.min_cbm));
  const hit = sorted.find((r: any) => c >= num(r.min_cbm) && c <= num(r.max_cbm));
  if (!hit) return null;
  const amount = type === CARGO_TYPE_HIGH_RISK ? num(hit.rate_high_risk) : num(hit.rate_regular);
  return amount > 0 ? amount : null;
}

const isDoorToDoor = (desc: string) => /puerta\s*a\s*puerta/i.test(String(desc || ""));
const shortDesc = (desc: string) => {
  const d = String(desc || "").trim();
  return d.length > 70 ? `${d.slice(0, 67)}...` : d;
};

function buildReceiptIndex(receipts: any[]) {
  const byId: Record<string, any> = {};
  const byNumber: Record<string, any> = {};
  const byTracking: Record<string, any> = {};
  for (const r of receipts || []) {
    if (!r) continue;
    if (r.id) byId[r.id] = r;
    const n = normOrder(r.invoice_number);
    if (n && !byNumber[n]) byNumber[n] = r;
    for (const t of r.tracking_numbers || []) {
      const k = normTracking(t);
      if (k && !byTracking[k]) byTracking[k] = r;
    }
  }
  return { byId, byNumber, byTracking };
}

// CBM facturado de una línea: el que quedó guardado en la propia factura. Nunca
// se toma el CBM del recibo aquí, para no alterar mínimos ni ajustes.
function cbmBasis(line: any) {
  const details = line?.item?.details || {};
  const qty = num(line?.item?.quantity);
  const pairs = parenPairs(line?.desc).reduce((s: number, p: any) => s + p.cbm, 0);
  const values = [
    line?.has_link ? qty : 0,
    num(details.billed_cbm),
    num(details.cbm),
    num(details.total_cbm),
    pairs,
    qty > 1 ? qty : 0,
  ];
  return Math.max(0, ...values);
}

// ¿La línea se cobró con precio fijo por tramo de carga chica? Solo cuando el
// precio guardado NO cuadra como precio por CBM: si cuadra, se respeta como
// precio por CBM para no reinterpretar una factura ya cobrada.
function isTramoLine(lineTotal: number, basis: number, rateSet: any, ctx: any) {
  const eff = num(lineTotal) / num(basis);
  const gen = ratePerCbmFor(ctx, rateSet, CARGO_TYPE_GENERAL);
  const high = ratePerCbmFor(ctx, rateSet, CARGO_TYPE_HIGH_RISK);
  const tol = 0.05;
  if (eff >= gen * (1 - tol) && eff <= high * (1 + tol)) return false;
  const near = (v: any) => v !== null && Math.abs(num(lineTotal) - num(v)) <= Math.max(0.5, num(v) * 0.005);
  return near(specialRateFor(rateSet, basis, CARGO_TYPE_GENERAL))
    || near(specialRateFor(rateSet, basis, CARGO_TYPE_HIGH_RISK));
}

// Cómo queda la factura al recalcular cada recibo con la tarifa de su tipo de
// carga. Devuelve el detalle por recibo, el antes y el después, y el objeto con
// el que se actualiza la factura (solo si hay cambio real).
export function buildInvoiceRecalc({ invoice, receiptsOfClient, ctx, overrides }: any) {
  const items = Array.isArray(invoice?.items) ? invoice.items : [];
  const lines = invoiceLines(invoice);
  const index = buildReceiptIndex(receiptsOfClient);
  const fallbackType = normalizeCargoType(invoice?.cost_breakdown?.cargo_type || CARGO_TYPE_GENERAL);

  const warnings: string[] = [];
  const units: any[] = [];
  const linePlans: any[] = [];
  let shippingBefore = 0;
  let shippingAfter = 0;

  for (const l of lines) {
    const details = l.item?.details || {};
    const basis = isDoorToDoor(l.desc) ? 0 : cbmBasis(l);
    const lineTotal = num(l.item?.total);
    const lineQty = num(l.item?.quantity);

    if (basis <= 0) {
      if (!isDoorToDoor(l.desc)) {
        warnings.push(`La línea "${shortDesc(l.desc)}" no tiene CBM facturado: se dejó sin cambios.`);
      }
      continue;
    }

    // Recibos de la línea: los del detalle guardado y los del propio texto.
    const numbers: string[] = [];
    const push = (v: any) => { const s = String(v ?? "").trim(); if (s && !numbers.includes(s)) numbers.push(s); };
    (l.source_numbers || []).forEach(push);
    parenPairs(l.desc).forEach((p: any) => push(p.number));
    if (l.number) push(l.number);

    const hintCbm: Record<string, number> = {};
    parenPairs(l.desc).forEach((p: any) => { if (!hintCbm[p.number]) hintCbm[p.number] = p.cbm; });

    let lineUnits = numbers.map((n) => ({ number: n, receipt: index.byNumber[normOrder(n)] || null }));
    if (!lineUnits.length) {
      lineUnits = [{ number: "", receipt: l.id ? (index.byId[l.id] || null) : null }];
    }

    // Peso de cada recibo dentro del CBM facturado de la línea.
    const weights = lineUnits.map((u: any) => {
      const hint = num(hintCbm[u.number]);
      return hint > 0 ? hint : num(u.receipt?.cbm);
    });
    const allKnown = weights.length > 0 && weights.every((w: number) => w > 0);
    const finalWeights = allKnown ? weights : lineUnits.map(() => 1);
    if (!allKnown && lineUnits.length > 1) {
      warnings.push(`La línea "${shortDesc(l.desc)}" trae varios recibos sin CBM: se repartió en partes iguales.`);
    }
    const weightSum = finalWeights.reduce((s: number, w: number) => s + w, 0) || lineUnits.length;

    if (lineUnits.length > 1 && lineUnits.every((u: any) => num(hintCbm[u.number]) > 0)) {
      const parenSum = lineUnits.reduce((s: number, u: any) => s + num(hintCbm[u.number]), 0);
      if (Math.abs(parenSum - basis) > Math.max(0.002, basis * 0.02)) {
        warnings.push(`En "${shortDesc(l.desc)}" los CBM del detalle no cuadran con el CBM facturado: se repartió a escala para conservar el CBM facturado.`);
      }
    }

    // Precio por CBM que ya tenía la línea y modelo con el que se cobró.
    const effStored = lineTotal / basis;
    const refFecha = lineUnits[0]?.receipt?.fecha || invoice?.invoice_date || null;
    const tramoLine = isTramoLine(lineTotal, basis, rateSetForDate(ctx, refFecha), ctx);

    const unitPlan: any[] = [];
    const lineTypes: Record<string, string> = {};
    lineUnits.forEach((u: any, i: number) => {
      const key = unitKey(invoice?.id, l.index, u.number, i);
      const saved = u.number ? (details.cargo_types?.[u.number] || null) : null;
      const override = overrides?.[key];
      const type = normalizeCargoType(
        override || saved || l.type || u.receipt?.cargo_type || fallbackType
      );
      if (u.number) lineTypes[u.number] = type;
      unitPlan.push({
        u,
        i,
        key,
        type,
        share: round5(basis * finalWeights[i] / weightSum),
        fecha: u.receipt?.fecha || invoice?.invoice_date || null,
        beforeShare: lineTotal * (finalWeights[i] / weightSum),
      });
    });

    // Precio fijo por tramo: si todos los recibos comparten tipo, la línea
    // conserva su precio de tramo; si están mezclados, cada recibo paga el
    // tramo de su propio CBM y su tipo.
    const plannedTypes = [...new Set(unitPlan.map((p: any) => p.type))];
    const flatTramo = tramoLine && plannedTypes.length === 1
      ? specialRateFor(rateSetForDate(ctx, refFecha), basis, plannedTypes[0])
      : null;
    if (tramoLine && plannedTypes.length > 1) {
      warnings.push(`La línea "${shortDesc(l.desc)}" se cobró con precio fijo por tramo y ahora sus recibos tienen tipos distintos: cada uno paga el tramo de su CBM.`);
    }

    unitPlan.forEach((p: any) => {
      const rateSet = rateSetForDate(ctx, p.fecha);
      const genRate = ratePerCbmFor(ctx, rateSet, CARGO_TYPE_GENERAL);
      const highRate = ratePerCbmFor(ctx, rateSet, CARGO_TYPE_HIGH_RISK);
      // Tipo con el que la factura YA venía cobrando la línea (el que le dio su
      // precio guardado): el ajuste es relativo a ESE tipo, no a general, para
      // no cobrar dos veces el recargo de alto riesgo. Si la línea no guarda el
      // tipo, solo se da por alto riesgo cuando el precio coincide con esa
      // tarifa; un precio intermedio (tramo) se respeta tal cual.
      const explicitType = String(details.cargo_type || l.type || "").trim()
        ? normalizeCargoType(details.cargo_type || l.type)
        : null;
      // Sin tipo guardado se parte de "general": así una factura ya bien cobrada
      // no cambia por sí sola, solo cuando se marca el tipo de un recibo.
      const impliedType = explicitType || CARGO_TYPE_GENERAL;
      const baseRate = impliedType === CARGO_TYPE_HIGH_RISK ? highRate : genRate;
      const typeRate = p.type === CARGO_TYPE_HIGH_RISK ? highRate : genRate;
      // Recargo del tipo de carga vigente a la fecha del recibo.
      const ratio = baseRate > 0 ? typeRate / baseRate : 1;
      const tramo = specialRateFor(rateSet, p.share, p.type);

      let mode = "cbm";
      let unitAfter = round2(effStored * ratio);
      if (tramoLine) {
        if (flatTramo !== null) {
          mode = "tramo";
          unitAfter = round2(flatTramo / basis);
        } else if (tramo !== null) {
          mode = "tramo";
          unitAfter = p.share > 0 ? round2(tramo / p.share) : round2(tramo);
        }
      }
      const after = round2(p.share * unitAfter);

      if (!p.u.receipt) {
        warnings.push(`El recibo ${p.u.number || "(sin número)"} no se ubicó en el sistema: se usó la fecha de la factura y el tipo indicado.`);
      }

      units.push({
        key: p.key,
        line_index: l.index,
        desc: shortDesc(l.desc),
        number: p.u.number,
        cbm_ingreso_id: p.u.receipt?.id || null,
        cbm: p.share,
        fecha: p.fecha,
        type: p.type,
        type_from: overrides?.[p.key] ? "manual" : (saved_of(details, p.u.number) || l.type ? "guardado" : (p.u.receipt?.cargo_type ? "recibo" : "predeterminado")),
        mode,
        rate_general: round2(genRate),
        rate_high: round2(highRate),
        unit_before: round2(effStored),
        unit_after: unitAfter,
        total_before: round2(p.beforeShare),
        total_after: after,
      });
      shippingAfter += after;
    });

    const typesUsed = [...new Set(Object.values(lineTypes))];
    linePlans.push({
      index: l.index,
      quantity: lineQty,
      types: lineTypes,
      uniformType: typesUsed.length === 1 ? typesUsed[0] : null,
      total_after: round2(units.filter((u: any) => u.line_index === l.index).reduce((s: number, u: any) => s + u.total_after, 0)),
    });
    shippingBefore += lineTotal;
  }

  const shippingBeforeR = round2(shippingBefore);
  const shippingAfterR = round2(shippingAfter);
  const delta = round2(shippingAfterR - shippingBeforeR);
  const totalBefore = num(invoice?.total);
  // El total se mueve solo por el envío: seguro, consolidación, puerta a puerta
  // y extras quedan intactos.
  const totalAfter = round2(totalBefore + delta);
  const blocked = !linePlans.length
    ? "Esta factura no tiene líneas de envío con CBM facturado que recalcular."
    : null;
  const changed = !blocked && Math.abs(delta) >= 0.05;

  const newItems = changed ? items.map((it: any, i: number) => {
    const plan = linePlans.find((p: any) => p.index === i);
    if (!plan) return it;
    const details: any = {
      ...(it?.details || {}),
      cargo_types: { ...(it?.details?.cargo_types || {}), ...plan.types },
    };
    if (plan.uniformType) details.cargo_type = plan.uniformType;
    else delete details.cargo_type;
    return {
      ...it,
      unit_price: round2(plan.quantity > 0 ? plan.total_after / plan.quantity : plan.total_after),
      total: plan.total_after,
      details,
    };
  }) : null;

  return {
    invoice_id: invoice?.id || null,
    before: { total: totalBefore, shipping: shippingBeforeR },
    after: { total: totalAfter, shipping: shippingAfterR },
    delta,
    changed,
    blocked,
    warnings: [...new Set(warnings)],
    lines: units,
    updates: changed ? {
      items: newItems,
      subtotal: totalAfter,
      total: totalAfter,
      cost_breakdown: {
        ...(invoice?.cost_breakdown || {}),
        shipping_total: shippingAfterR,
      },
    } : null,
  };
}

function saved_of(details: any, number: any) {
  return number ? (details?.cargo_types?.[number] || null) : null;
}