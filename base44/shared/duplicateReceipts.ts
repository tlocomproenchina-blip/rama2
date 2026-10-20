// Fusión de recibos duplicados de contabilidad (CbmIngreso).
//
// En Facturación Manual aparecen dos o más recibos del mismo cliente con el
// mismo N° de contenedor y el mismo CBM: al facturarlos se duplican líneas y montos.
// Este módulo detecta esos grupos, decide cuál recibo sobrevive y ejecuta la
// fusión real: CBM y paquetes sumados, trackings unidos, duplicado eliminado,
// con rastro de auditoría. Si alguno de los recibos ya está dentro de una
// factura emitida, la factura se recalcula (líneas de envío, CBM, desglose y
// total) apuntando al recibo superviviente, sin cobrar dos veces la misma carga.
import { num, normTracking, fetchAllFilter } from "./paginatedFetch.ts";
import {
  consolidatedShipping, rateForReceipt, round2, round5,
} from "./billingRates.ts";

// Los CBM se comparan con tolerancia: 0.05964 y 0.06 son el mismo volumen mal redondeado.
export const CBM_TOLERANCE = 0.001;

// N° de contenedor normalizado: sin prefijo "NO:", espacios, puntos ni guiones.
export function normOrder(raw: any) {
  return String(raw ?? "")
    .toUpperCase()
    .replace(/^N[º°O]?\.?\s*[:#-]?\s*/, "")
    .replace(/[\s.#:º°-]/g, "")
    .trim();
}

export function mergeTrackings(list: any[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of list || []) {
    for (const t of (r?.tracking_numbers || [])) {
      const key = normTracking(t);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(String(t).trim());
    }
  }
  return out;
}

function score(receipt: any) {
  return (receipt?.tracking_numbers || []).length
    + (receipt?.ve_synced_date ? 2 : 0)
    + (num(receipt?.package_count) > 0 ? 1 : 0)
    + (receipt?.billed ? 1 : 0);
}

// Superviviente: el que más información tiene (trackings, traza del almacén de
// Venezuela, conteo, factura) y, a igualdad, el más reciente.
export function pickSurvivor(list: any[]) {
  return [...(list || [])].sort((a, b) => {
    const diff = score(b) - score(a);
    if (diff !== 0) return diff;
    const da = new Date(a?.fecha || a?.created_date || 0).getTime();
    const db = new Date(b?.fecha || b?.created_date || 0).getTime();
    if (db !== da) return db - da;
    return String(b?.id || "").localeCompare(String(a?.id || ""));
  })[0];
}

// Agrupa los recibos del mismo cliente que comparten N° de contenedor normalizado.
export function detectGroups(receipts: any[]) {
  const byKey: Record<string, any[]> = {};
  for (const r of receipts || []) {
    const order = normOrder(r?.invoice_number);
    const email = String(r?.client_email || "").trim().toLowerCase();
    if (!order || !email) continue;
    const key = `${email}||${order}`;
    if (!byKey[key]) byKey[key] = [];
    byKey[key].push(r);
  }

  const groups: any[] = [];
  for (const [key, list] of Object.entries(byKey)) {
    if (list.length < 2) continue;
    const cbms = list.map((r) => num(r.cbm));
    const min = Math.min(...cbms);
    const max = Math.max(...cbms);
    const trackingSets = list.map((r) => new Set((r.tracking_numbers || []).map(normTracking).filter(Boolean)));
    let sharedTrackings = false;
    for (let i = 0; i < trackingSets.length && !sharedTrackings; i++) {
      for (let j = i + 1; j < trackingSets.length; j++) {
        for (const k of trackingSets[i]) {
          if (trackingSets[j].has(k)) { sharedTrackings = true; break; }
        }
        if (sharedTrackings) break;
      }
    }
    groups.push({
      key, list,
      cbm_min: min, cbm_max: max,
      same_cbm: cbms.every((c) => c > 0) && (max - min) <= CBM_TOLERANCE,
      shared_trackings: sharedTrackings,
    });
  }
  return groups.sort((a, b) => String(a.key).localeCompare(String(b.key)));
}

// ---------- Lectura de las líneas de envío de una factura ----------

const parseCbmFromDesc = (desc: any) => {
  const m = String(desc || "").match(/\(([\d.]+)\s*CBM\)/i);
  return m ? num(m[1]) : 0;
};

const isShippingDesc = (desc: any) => /^env[ií]o\b/i.test(String(desc || "").trim());

function tokensFromDesc(desc: any) {
  return String(desc || "")
    .replace(/^env[ií]o\b\s*[-–:]?\s*/i, "")
    .replace(/\([^)]*\)/g, "")
    .split(/[,;|]/)
    .map((t) => normTracking(t))
    .filter(Boolean);
}

// Líneas de envío de la factura. En las facturas nuevas cada línea lleva el
// número de contenedor en `details` y viene listada en `manual_recibos`; las
// facturas antiguas sólo describen los trackings ("Envío - <trackings> (X CBM)").
export function invoiceLines(invoice: any) {
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const manual = Array.isArray(invoice.manual_recibos) ? invoice.manual_recibos : [];
  const lines: any[] = [];

  items.forEach((item: any, index: number) => {
    const details = item?.details || {};
    const desc = String(item?.description || "");
    const linked = !!details.invoice_number;
    if (!linked && !isShippingDesc(desc)) return;
    lines.push({
      index,
      item,
      has_link: linked,
      id: null,
      number: linked ? String(details.invoice_number) : "",
      cbm: linked
        ? num(item.quantity ?? details.cbm)
        : (parseCbmFromDesc(desc) || (num(item.quantity) > 1 ? num(item.quantity) : 0)),
      amount: num(item.total),
      desc,
      tracking_keys: tokensFromDesc(desc),
      // Una línea puede agrupar varios recibos: "Envío - 68 - 64 - 64 ... (CBM facturado)".
      source_numbers: Array.isArray(details.source_invoices) ? details.source_invoices.map(String) : [],
      type: details.cargo_type || null,
    });
  });

  // Cada recibo del detalle manual se casa con su línea por número y CBM.
  const used = new Set<number>();
  for (const m of manual) {
    const number = String(m.invoice_number || "");
    let match = lines.find((l: any) => !used.has(l.index) && l.has_link && l.number === number
      && (!num(m.cbm) || Math.abs(l.cbm - num(m.cbm)) < CBM_TOLERANCE));
    if (!match) match = lines.find((l: any) => !used.has(l.index) && l.number && l.number === number);
    if (match) {
      used.add(match.index);
      match.id = m.cbm_ingreso_id || null;
      match.type = m.cargo_type || match.type;
      if (!match.tracking_keys.length && (m.tracking_numbers || []).length) {
        match.tracking_keys = (m.tracking_numbers || []).map(normTracking).filter(Boolean);
      }
    }
  }
  return lines;
}

// Casa un recibo con una línea de envío: primero por trackings, luego por
// N° de contenedor y, si no hay nada mejor, por CBM cuando sólo hay una candidata.
function matchLine(lines: any[], usedIdx: Set<number>, receipt: any) {
  const keys = (receipt?.tracking_numbers || []).map(normTracking).filter(Boolean);
  if (keys.length) {
    let best: any = null;
    let bestHits = 0;
    for (const l of lines) {
      if (usedIdx.has(l.index)) continue;
      const hits = l.tracking_keys.filter((k: string) => keys.includes(k)).length;
      if (hits > bestHits) { bestHits = hits; best = l; }
    }
    if (best && bestHits > 0) return best;
  }

  const order = normOrder(receipt?.invoice_number);
  if (order) {
    const byNumber = lines.find((l: any) => !usedIdx.has(l.index) && l.number && normOrder(l.number) === order);
    if (byNumber) return byNumber;
  }

  const cbm = num(receipt?.cbm);
  if (cbm > 0) {
    const byCbm = lines.filter((l: any) => !usedIdx.has(l.index) && num(l.cbm) > 0 && Math.abs(num(l.cbm) - cbm) <= CBM_TOLERANCE);
    if (byCbm.length === 1) return byCbm[0];
  }
  return null;
}

export async function loadInvoicesById(base44: any, ids: string[]) {
  const list = [...new Set((ids || []).filter(Boolean))];
  const out: Record<string, any> = {};
  if (!list.length) return out;
  const invoices = await base44.asServiceRole.entities.Invoice
    .filter({ id: { $in: list } }, "-invoice_date", list.length + 5)
    .catch(() => []);
  for (const inv of invoices || []) out[inv.id] = inv;
  return out;
}

// Plan de una fusión: quién sobrevive, qué CBM queda y en qué factura queda el recibo.
export function buildPlan(list: any[], existingInvoiceIds: Set<string>, keepId?: string) {
  const receipts = (list || []).filter((r: any) => r?.id);
  if (receipts.length < 2) return null;

  const keep = (keepId && receipts.find((r: any) => r.id === keepId)) || pickSurvivor(receipts);
  const absorbed = receipts.filter((r: any) => r.id !== keep.id);

  const hasInvoice = (id: any) => !!id && existingInvoiceIds.has(String(id));
  let destination: string | null = hasInvoice(keep.billed_invoice_id) ? String(keep.billed_invoice_id) : null;
  if (!destination) {
    const candidates = absorbed
      .filter((r: any) => hasInvoice(r.billed_invoice_id))
      .sort((a: any, b: any) => new Date(b.fecha || b.created_date || 0).getTime() - new Date(a.fecha || a.created_date || 0).getTime());
    destination = candidates.length ? String(candidates[0].billed_invoice_id) : null;
  }

  const cbms = receipts.map((r: any) => num(r.cbm));
  return {
    keep,
    absorbed,
    order: String(keep.invoice_number || ""),
    mergedCbm: round5(receipts.reduce((s: number, r: any) => s + num(r.cbm), 0)),
    mergedPackageCount: receipts.reduce((s: number, r: any) => s + num(r.package_count), 0),
    trackings: mergeTrackings(receipts),
    destinationInvoiceId: destination,
    same_cbm: (Math.max(...cbms) - Math.min(...cbms)) <= CBM_TOLERANCE,
  };
}

// ---------- Recálculo de la factura ----------

// Devuelve cómo queda una factura tras la fusión. Si no puede ajustarla con
// seguridad, no la toca y explica por qué (`blocked`).
export function recalcInvoice({ invoice, plan, receiptsOfClient, ctx }: any) {
  const isDestination = !!plan.destinationInvoiceId && String(invoice.id) === String(plan.destinationInvoiceId);
  const absorbedIds = new Set(plan.absorbed.map((r: any) => r.id));
  const receiptsById: Record<string, any> = {};
  for (const r of receiptsOfClient || []) receiptsById[r.id] = r;

  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const manual = Array.isArray(invoice.manual_recibos) ? invoice.manual_recibos : [];
  const lines = invoiceLines(invoice);
  const usesLinks = lines.some((l: any) => l.has_link || !!l.id);

  const before = {
    total: num(invoice.total),
    billed_cbm: num(invoice.billed_cbm),
    total_cbm: num(invoice.total_cbm),
  };

  const removals = new Set<number>();
  const replacements: Record<number, any> = {};
  let addedLine: any = null;
  let mode = "preserved_rate";
  const warnings: string[] = [];

  if (usesLinks) {
    // ---- Factura con vínculo a los recibos: se recalcula con las tarifas vigentes ----
    mode = "exact";
    const absorbedLines = lines.filter((l: any) => l.id && absorbedIds.has(l.id));
    for (const id of absorbedIds) {
      const declares = plan.absorbed.find((r: any) => r.id === id);
      if (declares && String(declares.billed_invoice_id || "") === String(invoice.id) && !absorbedLines.some((l: any) => l.id === id)) {
        return { blocked: `El recibo ${declares.invoice_number || ""} (${num(declares.cbm).toFixed(5)} CBM) figura en esta factura pero su línea no se pudo ubicar. Revisa la factura ${invoice.invoice_number} a mano antes de fusionar.`, isDestination, before, after: before, updates: null, warnings };
      }
    }
    for (const l of absorbedLines) removals.add(l.index);

    const keepLine = lines.find((l: any) => l.id === plan.keep.id);
    if (isDestination) {
      if (keepLine && !removals.has(keepLine.index)) {
        replacements[keepLine.index] = {
          ...keepLine.item,
          description: `Envío ${plan.order}`,
          quantity: plan.mergedCbm,
          details: { ...(keepLine.item?.details || {}), cbm: plan.mergedCbm, invoice_number: plan.order, source_invoices: [plan.order] },
        };
      } else {
        addedLine = {
          description: `Envío ${plan.order}`,
          quantity: plan.mergedCbm,
          unit_price: 0,
          total: 0,
          details: { cbm: plan.mergedCbm, invoice_number: plan.order, source_invoices: [plan.order] },
        };
      }
    } else if (String(plan.keep.billed_invoice_id || "") === String(invoice.id)) {
      return { blocked: `El recibo a conservar no se pudo ubicar dentro de la factura ${invoice.invoice_number}. Revísala a mano antes de fusionar.`, isDestination, before, after: before, updates: null, warnings };
    }

    // Recibos finales de la factura, con su fecha y tipo de carga.
    const breakdown = invoice.cost_breakdown || {};
    const typeByNumber = breakdown.cargo_type_per_receipt || {};
    const fallbackType = breakdown.cargo_type || "general";
    const finalLines = lines
      .filter((l: any) => !removals.has(l.index) && !(l.id && l.id === plan.keep.id && !isDestination))
      .map((l: any) => {
        if (l.id === plan.keep.id && isDestination) {
          return { id: l.id, number: plan.order, cbm: plan.mergedCbm, amount: l.amount, type: l.type, tracking_numbers: plan.trackings, fecha: receiptsById[l.id]?.fecha || invoice.invoice_date || null };
        }
        const real = l.id ? receiptsById[l.id] : null;
        return {
          id: l.id,
          number: l.number || String(typeByNumber[l.desc] || ""),
          cbm: l.cbm,
          amount: l.amount,
          type: l.type || typeByNumber[l.number] || real?.cargo_type || fallbackType,
          tracking_numbers: real?.tracking_numbers || [],
          fecha: real?.fecha || invoice.invoice_date || null,
        };
      })
      .filter((l: any) => l.cbm >= 0);

    const newTotalCbm = round5(finalLines.reduce((s: number, l: any) => s + num(l.cbm), 0));
    const oldBilled = before.billed_cbm > 0 ? before.billed_cbm : before.total_cbm;
    const adjustment = (before.billed_cbm > 0 && before.total_cbm > 0) ? (before.billed_cbm - before.total_cbm) : 0;
    const newBilled = round5(Math.max(0, newTotalCbm + adjustment));
    const shipping = round2(consolidatedShipping(ctx, newBilled, finalLines, fallbackType));

    const rowLines = finalLines.map((l: any) => ({ line: l, rate: rateForReceipt(ctx, l.fecha, l.type) }));
    const baseSum = rowLines.reduce((s: number, r: any) => s + num(r.line.cbm) * num(r.rate), 0);
    const typeScale = baseSum > 0 ? shipping / baseSum : null;
    const flatRate = newBilled > 0 ? shipping / newBilled : 0;

    const shippingItems = rowLines.map(({ line, rate }: any) => {
      const unit = typeScale !== null ? num(rate) * typeScale : flatRate;
      return {
        description: `Envío ${line.number}`,
        quantity: line.cbm,
        unit_price: round2(unit),
        total: round2(num(line.cbm) * unit),
        details: { cbm: line.cbm, invoice_number: line.number, source_invoices: [line.number], cargo_type: line.type },
      };
    });

    const others = items.map((it: any, index: number) => ({ it, index })).filter(({ index }: any) => !lines.some((l: any) => l.index === index));
    const newItems = [...shippingItems, ...others.map(({ it }: any) => it)];
    const total = round2(newItems.reduce((s: number, it: any) => s + num(it.total), 0));

    return {
      blocked: null,
      mode,
      isDestination,
      before,
      after: { total, billed_cbm: newBilled, total_cbm: newTotalCbm, shipping_total: shipping },
      warnings,
      updates: {
        items: newItems,
        subtotal: total,
        total,
        total_cbm: newTotalCbm,
        billed_cbm: newBilled,
        manual_recibos: finalLines.map((l: any) => ({
          cbm_ingreso_id: l.id || null,
          invoice_number: l.number,
          cbm: l.cbm,
          cargo_type: l.type,
          tracking_numbers: l.tracking_numbers || [],
        })),
        cost_breakdown: {
          ...breakdown,
          total_cbm: newTotalCbm,
          billed_cbm: newBilled,
          shipping_total: shipping,
          rate_per_cbm: newBilled > 0 ? Number((shipping / newBilled).toFixed(4)) : 0,
        },
      },
    };
  }

  // ---- Factura antigua (sin vínculo a recibos): se conserva la tarifa ya aplicada ----
  // Si la factura ya agrupa estos recibos en una sola línea consolidada, su monto
  // corresponde a la suma de los CBM: fusionarlos no cambia nada y no se toca.
  const declared = [plan.keep, ...plan.absorbed]
    .filter((r: any) => String(r.billed_invoice_id || "") === String(invoice.id));
  const aggregated = lines.filter((l: any) => l.source_numbers.filter(Boolean).length > 1);
  if (declared.length && aggregated.length) {
    const covered = declared.some((r: any) => aggregated.some(
      (l: any) => l.source_numbers.map(normOrder).includes(normOrder(r.invoice_number))
    ));
    if (covered) {
      return {
        blocked: null,
        mode: "no_change",
        isDestination,
        before,
        after: before,
        warnings: ["La factura ya refleja el volumen sumado de estos recibos en una sola línea: no se ajusta su monto."],
        updates: null,
      };
    }
  }

  const usedIdx = new Set<number>();
  const absorbedLines: any[] = [];
  for (const r of plan.absorbed) {
    if (String(r.billed_invoice_id || "") !== String(invoice.id)) continue;
    const line = matchLine(lines, usedIdx, r);
    if (!line) {
      return { blocked: `El recibo ${r.invoice_number || ""} (${num(r.cbm).toFixed(5)} CBM) figura en esta factura pero su línea no se pudo ubicar por sus trackings. Revisa la factura ${invoice.invoice_number} a mano antes de fusionar.`, isDestination, before, after: before, updates: null, warnings };
    }
    usedIdx.add(line.index);
    absorbedLines.push(line);
  }

  const keepExpected = String(plan.keep.billed_invoice_id || "") === String(invoice.id);
  let keepLine: any = isDestination ? matchLine(lines, usedIdx, plan.keep) : null;
  if (keepLine) usedIdx.add(keepLine.index);
  if (isDestination && !keepLine && keepExpected) {
    return { blocked: `El recibo a conservar no se pudo ubicar dentro de la factura ${invoice.invoice_number}. Revísala a mano antes de fusionar.`, isDestination, before, after: before, updates: null, warnings };
  }

  const unitRate = keepLine && num(keepLine.cbm) > 0
    ? num(keepLine.amount) / num(keepLine.cbm)
    : (absorbedLines.length && num(absorbedLines[0].cbm) > 0 ? num(absorbedLines[0].amount) / num(absorbedLines[0].cbm) : 0);
  const keepAmount = round2(plan.mergedCbm * unitRate);

  for (const l of absorbedLines) removals.add(l.index);
  if (keepLine) {
    const desc = keepLine.desc.includes("(")
      ? keepLine.desc.replace(/\(([\d.]+)\s*CBM\)/i, `(${plan.mergedCbm.toFixed(4)} CBM)`)
      : `${keepLine.desc} (${plan.mergedCbm.toFixed(4)} CBM)`;
    replacements[keepLine.index] = {
      ...keepLine.item,
      description: desc,
      unit_price: num(keepLine.item?.quantity) > 1 ? num(keepLine.item.unit_price) : keepAmount,
      total: keepAmount,
      ...(keepLine.item?.details ? { details: { ...keepLine.item.details, cbm: plan.mergedCbm } } : {}),
    };
  } else if (isDestination) {
    addedLine = {
      description: `Envío - ${plan.trackings.join(", ")} (${plan.mergedCbm.toFixed(4)} CBM)`,
      quantity: 1,
      unit_price: keepAmount,
      total: keepAmount,
    };
    warnings.push("La línea de envío del recibo fusionado se agregó a la factura; se conservó la tarifa ya aplicada en ella.");
  }

  if (unitRate <= 0 && (isDestination || absorbedLines.length)) {
    return { blocked: `La factura ${invoice.invoice_number} no tiene un monto de envío con el que se pueda recalcular esta carga. Revísala a mano antes de fusionar.`, isDestination, before, after: before, updates: null, warnings };
  }

  const shippingLines = lines
    .filter((l: any) => !removals.has(l.index))
    .map((l: any) => (l.index === keepLine?.index && replacements[l.index]) ? { cbm: plan.mergedCbm, amount: keepAmount } : { cbm: l.cbm, amount: l.amount });
  const totalCbm = round5(shippingLines.reduce((s: number, l: any) => s + num(l.cbm), 0));
  const shippingTotal = round2(shippingLines.reduce((s: number, l: any) => s + num(l.amount), 0));

  const finalItems = items
    .map((it: any, index: number) => ({ it, index }))
    .filter(({ index }: any) => !removals.has(index))
    .map(({ it, index }: any) => replacements[index] || it);
  if (addedLine) finalItems.push(addedLine);

  const total = round2(finalItems.reduce((s: number, it: any) => s + num(it.total), 0));
  const billed = before.billed_cbm > 0 && before.total_cbm > 0
    ? round5(Math.max(0, totalCbm + (before.billed_cbm - before.total_cbm)))
    : totalCbm;

  warnings.push("Se conservó la tarifa ya aplicada en esta factura.");

  return {
    blocked: null,
    mode,
    isDestination,
    before,
    after: { total, billed_cbm: billed, total_cbm: totalCbm, shipping_total: shippingTotal },
    warnings,
    updates: {
      items: finalItems,
      subtotal: total,
      total,
      total_cbm: totalCbm,
      billed_cbm: billed,
      manual_recibos: Array.isArray(invoice.manual_recibos) && invoice.manual_recibos.length
        ? invoice.manual_recibos
        : undefined,
      cost_breakdown: {
        ...(invoice.cost_breakdown || {}),
        total_cbm: totalCbm,
        billed_cbm: billed,
        shipping_total: shippingTotal,
        rate_per_cbm: billed > 0 ? Number((shippingTotal / billed).toFixed(4)) : 0,
      },
    },
  };
}

// Previsualización de un grupo: qué queda, cuánto CBM y cómo cambian las facturas.
export function groupPreview({ group, plan, invoicesById, receiptsOfClient, ctx, clientName }: any) {
  const invoiceIds = [...new Set([
    plan.destinationInvoiceId,
    ...plan.absorbed.map((r: any) => r.billed_invoice_id),
  ].filter(Boolean))];

  const invoices: any[] = [];
  const warnings: string[] = [];
  let blocked: string | null = null;

  if (!plan.same_cbm) {
    warnings.push(`Los CBM de este grupo no son iguales (${num(group.cbm_min).toFixed(5)} y ${num(group.cbm_max).toFixed(5)}). Revisa antes de fusionar: se sumarán tal cual.`);
  }
  if (!plan.trackings.length) {
    warnings.push("Este grupo no tiene trackings registrados: el recibo fusionado quedará sin detalle de paquetes.");
  }
  if (plan.absorbed.length > 1) {
    warnings.push(`Se unirán ${plan.absorbed.length} recibos en uno solo.`);
  }
  if (group.shared_trackings) {
    warnings.push("Los recibos comparten trackings: confirma que son la misma carga registrada dos veces.");
  }

  for (const id of invoiceIds) {
    const invoice = invoicesById[id];
    if (!invoice) continue;
    const sim = recalcInvoice({ invoice, plan, receiptsOfClient, ctx });
    if (sim.blocked) {
      blocked = sim.blocked;
      warnings.push(sim.blocked);
      continue;
    }
    for (const w of sim.warnings || []) warnings.push(w);
    invoices.push({
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      status: invoice.status,
      is_destination: sim.isDestination,
      mode: sim.mode,
      unchanged: !sim.updates,
      total_before: sim.before.total,
      total_after: sim.after.total,
      billed_cbm_before: sim.before.billed_cbm || sim.before.total_cbm,
      billed_cbm_after: sim.after.billed_cbm,
    });
    if (invoice.status === "pagada") {
      warnings.push(`La factura ${invoice.invoice_number} ya está pagada: su total quedará en $${num(sim.after.total).toFixed(2)} (antes $${num(sim.before.total).toFixed(2)}).`);
    }
  }

  return {
    key: `${plan.keep.client_email}||${normOrder(plan.order)}`,
    client_email: plan.keep.client_email,
    client_name: clientName || plan.keep.client_name || plan.keep.client_email,
    order: plan.order,
    same_cbm: plan.same_cbm,
    shared_trackings: !!group.shared_trackings,
    cbm_min: num(group.cbm_min),
    cbm_max: num(group.cbm_max),
    merged_cbm: plan.mergedCbm,
    merged_package_count: plan.mergedPackageCount,
    merged_trackings_count: plan.trackings.length,
    distinct_invoices: new Set(invoices.map((i) => i.id)).size > 1,
    blocked,
    keep: {
      id: plan.keep.id,
      cbm: num(plan.keep.cbm),
      package_count: num(plan.keep.package_count),
      fecha: plan.keep.fecha || null,
      ve_synced_date: plan.keep.ve_synced_date || null,
      billed: !!plan.keep.billed,
    },
    absorbed: plan.absorbed.map((r: any) => ({
      id: r.id,
      cbm: num(r.cbm),
      package_count: num(r.package_count),
      fecha: r.fecha || null,
      billed: !!r.billed,
      billed_invoice_id: r.billed_invoice_id || null,
    })),
    invoices,
    warnings,
  };
}

// Ejecuta la fusión: recibo superviviente, facturas afectadas, duplicados fuera y auditoría.
export async function applyMerge(base44: any, plan: any, ctx: any, actor: any) {
  const keep = plan.keep;
  const absorbed = plan.absorbed;
  const now = new Date().toISOString();
  const by = actor?.email || "admin";

  const receiptsOfClient = await fetchAllFilter(
    base44.asServiceRole.entities.CbmIngreso, { client_email: keep.client_email }, "-fecha"
  );

  // 1) Comprobación previa: todas las facturas afectadas deben poder ajustarse.
  const invoiceIds = [...new Set([
    plan.destinationInvoiceId,
    ...absorbed.map((r: any) => r.billed_invoice_id),
  ].filter(Boolean))];
  const invoicesById = await loadInvoicesById(base44, invoiceIds);

  const mergedReceipts = (receiptsOfClient || []).map((r: any) => r.id === keep.id
    ? { ...r, cbm: plan.mergedCbm, package_count: plan.mergedPackageCount, tracking_numbers: plan.trackings, invoice_number: plan.order }
    : r);

  const simulations: any[] = [];
  for (const id of Object.keys(invoicesById)) {
    const invoice = invoicesById[id];
    const sim = recalcInvoice({ invoice, plan, receiptsOfClient: mergedReceipts, ctx });
    if (sim.blocked) return { skipped: true, order: plan.order, reason: sim.blocked, invoices: [] };
    simulations.push({ invoice, sim });
  }

  // 2) Recibo superviviente: CBM y paquetes sumados, trackings unidos, traza del almacén conservada.
  const syncMarks: any = {};
  for (const r of [keep, ...absorbed]) {
    if (r?.ve_synced_date && !syncMarks.ve_synced_date) {
      syncMarks.ve_synced_date = r.ve_synced_date;
      syncMarks.ve_synced_by = r.ve_synced_by || "";
      syncMarks.ve_synced_bulto_label = r.ve_synced_bulto_label || "";
    }
  }
  const mergeNote = `Fusión de recibos duplicados (${absorbed.map((a: any) => `${a.invoice_number || "s/n"} · ${num(a.cbm).toFixed(5)} CBM`).join(" + ")}) el ${now} por ${by}. CBM resultante: ${plan.mergedCbm.toFixed(5)}.`;

  await base44.asServiceRole.entities.CbmIngreso.update(keep.id, {
    cbm: plan.mergedCbm,
    package_count: plan.mergedPackageCount,
    tracking_numbers: plan.trackings,
    billed: plan.destinationInvoiceId ? true : !!keep.billed,
    billed_invoice_id: plan.destinationInvoiceId || keep.billed_invoice_id || null,
    notas: [String(keep.notas || "").trim(), mergeNote].filter(Boolean).join("\n").slice(0, 1000),
    ...syncMarks,
  });

  // 3) Facturas afectadas.
  const affected: any[] = [];
  for (const { invoice, sim } of simulations) {
    // Factura que ya agrupaba los recibos en una sola línea: no se toca su monto.
    if (!sim.updates) {
      affected.push({
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        total_before: sim.before.total,
        total_after: sim.before.total,
        unchanged: true,
      });
      continue;
    }
    const merges = [
      ...((invoice.cost_breakdown && invoice.cost_breakdown.duplicate_merges) || []),
      {
        at: now, by, order: plan.order, keep_id: keep.id,
        absorbed_ids: absorbed.map((a: any) => a.id),
        cbm_after: plan.mergedCbm,
        total_before: sim.before.total, total_after: sim.after.total,
      },
    ];
    const updates: any = {
      ...sim.updates,
      cost_breakdown: { ...sim.updates.cost_breakdown, duplicate_merges: merges },
      notes: [
        String(invoice.notes || "").trim(),
        `Recibos duplicados fusionados (${plan.order}) el ${now}: total $${num(invoice.total).toFixed(2)} → $${sim.after.total.toFixed(2)}.`,
      ].filter(Boolean).join("\n").slice(0, 1000),
    };
    if (updates.manual_recibos === undefined) delete updates.manual_recibos;

    await base44.asServiceRole.entities.Invoice.update(invoice.id, updates);
    affected.push({
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      total_before: sim.before.total,
      total_after: sim.after.total,
    });
  }

  // 4) Los recibos absorbidos se eliminan solo después de corregir la contraparte.
  for (const r of absorbed) {
    await base44.asServiceRole.entities.CbmIngreso.delete(r.id).catch(() => null);
  }

  // 5) Rastro en la auditoría de actividad.
  await base44.asServiceRole.entities.ActivityAuditLog.create({
    entity_name: "CbmIngreso",
    entity_id: keep.id,
    entity_label: `Recibo ${plan.order}`,
    action_type: "update",
    action_detail: `Fusión de recibos duplicados: ${absorbed.length} recibo(s) unido(s) en ${plan.order}${affected.length ? ` (facturas: ${affected.map((a) => a.invoice_number).join(", ")})` : ""}.`,
    actor_email: by,
    actor_name: actor?.full_name || "",
    actor_role: actor?.role || "admin",
    module_name: "Facturación Manual",
    page_path: "/AdminManualBilling",
    summary: `Recibos duplicados fusionados: ${plan.order}`,
    changed_fields: [
      { field_name: "cbm", old_value: String(num(keep.cbm)), new_value: String(plan.mergedCbm) },
      { field_name: "package_count", old_value: String(num(keep.package_count)), new_value: String(plan.mergedPackageCount) },
      { field_name: "tracking_numbers", old_value: String((keep.tracking_numbers || []).length), new_value: String(plan.trackings.length) },
      { field_name: "recibos_absorbidos", old_value: absorbed.map((a: any) => a.id).join(", "), new_value: "eliminados" },
    ],
    client_side_timestamp: now,
  }).catch(() => null);

  return {
    skipped: false,
    order: plan.order,
    client_email: keep.client_email,
    keep_id: keep.id,
    absorbed_ids: absorbed.map((a: any) => a.id),
    cbm_before: round5(keep.cbm),
    cbm_after: plan.mergedCbm,
    trackings: plan.trackings.length,
    invoices: affected,
  };
}