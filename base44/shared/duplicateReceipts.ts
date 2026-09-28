// Fusión de recibos duplicados de contabilidad (CbmIngreso).
//
// En Facturación Manual aparecen dos o más recibos del mismo cliente con el
// mismo N° de orden y el mismo CBM: al facturarlos se duplican líneas y montos.
// Este módulo detecta esos grupos, decide cuál recibo sobrevive y ejecuta la
// fusión real: CBM y paquetes sumados, trackings unidos, duplicado eliminado,
// con rastro de auditoría. Si alguno de los recibos ya está dentro de una
// factura emitida, la factura se recalcula (CBM, líneas de envío, desglose y
// total) apuntando al recibo superviviente.
import { num, normTracking, fetchAllFilter } from "./paginatedFetch.ts";
import {
  consolidatedShipping, rateForReceipt, DOOR_TO_DOOR_THRESHOLD, round2, round5,
} from "./billingRates.ts";

// Los CBM se comparan con tolerancia: 0.05964 y 0.06 son el mismo volumen mal redondeado.
export const CBM_TOLERANCE = 0.001;

// N° de orden normalizado: sin prefijo "NO:", espacios, puntos ni guiones.
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

// Agrupa los recibos del mismo cliente que comparten N° de orden normalizado.
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
    groups.push({ key, list, same_cbm: cbms.every((c) => c > 0) && (max - min) <= CBM_TOLERANCE, shared_trackings: sharedTrackings });
  }
  return groups.sort((a, b) => String(a.key).localeCompare(String(b.key)));
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

// ¿La línea del item corresponde al envío de un recibo?
const isShippingItem = (item: any) => !!(item?.details && item.details.invoice_number);

// Recalcula una factura como quedará después de la fusión del grupo.
// Devuelve los campos a escribir y el antes/después para mostrar en el diálogo.
export function recalcInvoice({ invoice, plan, receiptsOfClient, ctx }: any) {
  const isDestination = !!plan.destinationInvoiceId && String(invoice.id) === String(plan.destinationInvoiceId);
  const absorbedIds = new Set(plan.absorbed.map((r: any) => r.id));
  const receiptsById: Record<string, any> = {};
  for (const r of receiptsOfClient || []) receiptsById[r.id] = r;

  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const manual = Array.isArray(invoice.manual_recibos) ? invoice.manual_recibos : [];

  // Líneas de recibo que hoy tiene la factura.
  let lines: any[] = manual.length
    ? manual.map((m: any) => ({
      id: m.cbm_ingreso_id || null,
      number: String(m.invoice_number || ""),
      cbm: num(m.cbm),
      type: m.cargo_type || null,
      tracking_numbers: m.tracking_numbers || [],
    }))
    : items.filter(isShippingItem).map((it: any) => ({
      id: null,
      number: String(it.details.invoice_number || ""),
      cbm: num(it.quantity ?? it.details.cbm),
      type: it.details.cargo_type || null,
      tracking_numbers: [],
    }));

  // Los recibos absorbidos salen de esta factura.
  lines = lines.filter((l: any) => !(l.id && absorbedIds.has(l.id)));

  // La factura destino recibe el recibo fusionado con su CBM sumado.
  if (isDestination) {
    const merged = {
      id: plan.keep.id,
      number: plan.order,
      cbm: plan.mergedCbm,
      type: plan.keep.cargo_type || null,
      tracking_numbers: plan.trackings,
    };
    const existing = lines.find((l: any) => l.id === plan.keep.id);
    if (existing) {
      merged.type = existing.type || merged.type;
      Object.assign(existing, merged);
    } else {
      lines.push(merged);
    }
  }

  const breakdown = invoice.cost_breakdown || {};
  const typeByNumber = breakdown.cargo_type_per_receipt || {};
  const fallbackType = breakdown.cargo_type || "general";

  const enriched = lines
    .filter((l: any) => l.number && l.number !== "—")
    .map((l: any) => {
      const real = l.id ? receiptsById[l.id] : null;
      return {
        id: l.id,
        number: l.number,
        cbm: l.cbm,
        fecha: real?.fecha || invoice.invoice_date || null,
        type: l.type || typeByNumber[l.number] || real?.cargo_type || fallbackType,
        tracking_numbers: l.id === plan.keep.id ? plan.trackings : (real?.tracking_numbers || l.tracking_numbers || []),
      };
    });

  const newTotalCbm = round5(enriched.reduce((s: number, l: any) => s + num(l.cbm), 0));
  const oldBilled = num(invoice.billed_cbm);
  const oldTotal = num(invoice.total_cbm);
  // Se conserva el ajuste manual del CBM facturado si lo había.
  const adjustment = (oldBilled > 0 && oldTotal > 0) ? (oldBilled - oldTotal) : 0;
  const newBilled = round5(Math.max(0, newTotalCbm + adjustment));
  const shipping = round2(consolidatedShipping(ctx, newBilled, enriched, fallbackType));

  // Se regeneran las líneas de envío para que su suma sea el envío consolidado.
  const rowLines = enriched.map((l: any) => ({ line: l, rate: rateForReceipt(ctx, l.fecha, l.type) }));
  const baseLinesSum = rowLines.reduce((s: number, r: any) => s + num(r.line.cbm) * num(r.rate), 0);
  const typeScale = (newBilled >= DOOR_TO_DOOR_THRESHOLD && baseLinesSum > 0) ? shipping / baseLinesSum : null;
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

  const newItems = [...shippingItems, ...items.filter((it: any) => !isShippingItem(it))];
  const newTotal = round2(newItems.reduce((s: number, it: any) => s + num(it.total), 0));

  return {
    isDestination,
    updates: {
      items: newItems,
      subtotal: newTotal,
      total: newTotal,
      total_cbm: newTotalCbm,
      billed_cbm: newBilled,
      manual_recibos: enriched.map((l: any) => ({
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
    before: { total: num(invoice.total), billed_cbm: oldBilled, total_cbm: oldTotal },
    after: { total: newTotal, billed_cbm: newBilled, total_cbm: newTotalCbm, shipping_total: shipping },
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

  if (!plan.same_cbm) {
    warnings.push(`Los CBM de este grupo no son iguales (${num(group.cbm_min).toFixed(5)} y ${num(group.cbm_max).toFixed(5)}). Revisa antes de fusionar: se sumarán tal cual.`);
  }
  if (!plan.trackings.length) {
    warnings.push("Este grupo no tiene trackings registrados; el recibo fusionado quedará sin detalle de paquetes.");
  }
  if (plan.absorbed.length > 1) {
    warnings.push(`Se unirán ${plan.absorbed.length} recibos en uno solo.`);
  }

  for (const id of invoiceIds) {
    const invoice = invoicesById[id];
    if (!invoice) continue;
    const sim = recalcInvoice({ invoice, plan, receiptsOfClient, ctx });
    invoices.push({
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      status: invoice.status,
      is_destination: sim.isDestination,
      total_before: sim.before.total,
      total_after: sim.after.total,
      billed_cbm_before: sim.before.billed_cbm,
      billed_cbm_after: sim.after.billed_cbm,
    });
  }

  const paid = invoices.filter((i) => i.status === "pagada");
  for (const p of paid) {
    warnings.push(`La factura ${p.invoice_number} ya está pagada: su total cambiará de $${num(p.total_before).toFixed(2)} a $${num(p.total_after).toFixed(2)}.`);
  }

  return {
    key: `${plan.keep.client_email}||${normOrder(plan.order)}`,
    client_email: plan.keep.client_email,
    client_name: clientName || plan.keep.client_name || plan.keep.client_email,
    order: plan.order,
    same_cbm: plan.same_cbm,
    shared_trackings: !!group.shared_trackings,
    cbm_min: group.cbm_min,
    cbm_max: group.cbm_max,
    merged_cbm: plan.mergedCbm,
    merged_package_count: plan.mergedPackageCount,
    merged_trackings_count: plan.trackings.length,
    distinct_invoices: new Set(invoices.map((i) => i.id)).size > 1,
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

  // 1) Recibo superviviente: CBM y paquetes sumados, trackings unidos, traza del almacén conservada.
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

  // 2) Facturas afectadas.
  const invoiceIds = [...new Set([
    plan.destinationInvoiceId,
    ...absorbed.map((r: any) => r.billed_invoice_id),
  ].filter(Boolean))];
  const invoicesById = await loadInvoicesById(base44, invoiceIds);

  const mergedReceipts = (receiptsOfClient || []).map((r: any) => r.id === keep.id
    ? { ...r, cbm: plan.mergedCbm, package_count: plan.mergedPackageCount, tracking_numbers: plan.trackings, invoice_number: plan.order }
    : r);

  const affected: any[] = [];
  for (const id of Object.keys(invoicesById)) {
    const invoice = invoicesById[id];
    const sim = recalcInvoice({ invoice, plan, receiptsOfClient: mergedReceipts, ctx });
    const merges = [
      ...((invoice.cost_breakdown && invoice.cost_breakdown.duplicate_merges) || []),
      {
        at: now, by, order: plan.order, keep_id: keep.id,
        absorbed_ids: absorbed.map((a: any) => a.id),
        cbm_after: plan.mergedCbm,
        total_before: sim.before.total, total_after: sim.after.total,
      },
    ];

    await base44.asServiceRole.entities.Invoice.update(invoice.id, {
      ...sim.updates,
      cost_breakdown: { ...sim.updates.cost_breakdown, duplicate_merges: merges },
      notes: [
        String(invoice.notes || "").trim(),
        `Recibos duplicados fusionados (${plan.order}) el ${now}: total $${num(invoice.total).toFixed(2)} → $${sim.after.total.toFixed(2)}.`,
      ].filter(Boolean).join("\n").slice(0, 1000),
    });

    affected.push({
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      total_before: sim.before.total,
      total_after: sim.after.total,
    });
  }

  // 3) Los recibos absorbidos se eliminan solo después de corregir la contraparte.
  for (const r of absorbed) {
    await base44.asServiceRole.entities.CbmIngreso.delete(r.id).catch(() => null);
  }

  // 4) Rastro en la auditoría de actividad.
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
    order: plan.order,
    client_email: keep.client_email,
    keep_id: keep.id,
    absorbed_ids: absorbed.map((a: any) => a.id),
    cbm_before: round5((keep.cbm)),
    cbm_after: plan.mergedCbm,
    trackings: plan.trackings.length,
    invoices: affected,
  };
}

export { DOOR_TO_DOOR_THRESHOLD };