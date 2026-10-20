// Cargos de almacenamiento y custodia de las facturas impagas.
//
// Reglas del contrato (secciones VII, XIII y XV):
//   - Días 1 al 7 desde la emisión de la factura: almacenamiento gratuito.
//   - Desde el día 8: USD 10 diarios por bulto estándar (hasta 0.027 CBM de
//     volumen, que equivale a 30 × 30 × 30 cm) y USD 20 diarios por bulto grande
//     (supera ese volumen). El volumen del bulto se compara en CBM, que es la
//     unidad con la que se factura la carga.
//   - El recargo de montacargas es USD 150 por palet, UNA sola vez por palet y NO
//     lo cobra el proceso automático: lo aplica un administrador a mano.
//   - Hasta el día 45 se sigue acumulando; después el sistema deja de cobrar.
//   - No existe una penalización independiente por mora: aquí solo hay
//     almacenamiento y custodia, más el recargo de montacargas.
//
// Este módulo resuelve, para cada factura impaga: las unidades que siguen en el
// almacén, su categoría, los días nuevos que hay que cobrar (idempotente: nunca
// repite un día ya registrado), el monto del día y cómo queda la factura.
//
// Lo usan la función processStorageCharges (cálculo y aplicación diaria) y el
// panel de Gestión de Facturas que lo revisa antes de aplicar.

import { packageCountOfBulto } from "./dispatchGuideAppend.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
// Venezuela no tiene horario de verano: UTC-4 todo el año.
const CARACAS_OFFSET_MS = 4 * 60 * 60 * 1000;

export const CATEGORY_STANDARD = "estandar";
export const CATEGORY_LARGE = "grande";
export const STORAGE_LINE_KIND = "storage_charge";
export const FORKLIFT_LINE_KIND = "forklift_charge";

// Almacenamiento y resguardo en pausa: no se generan ni se aplican cargos nuevos
// a las facturas. Los registros históricos de StorageCharge y las líneas ya
// guardadas se conservan intactos para auditoría.
export const STORAGE_CHARGES_ENABLED = false;

export const DEFAULT_STORAGE_CONFIG: Record<string, any> = {
  config_key: "main",
  is_active: true,
  free_days: 7,
  max_days: 45,
  standard_daily_rate: 10,
  large_daily_rate: 20,
  forklift_fee: 150,
  standard_max_cbm: 0.027,
  large_if_multiple_packages: true,
  default_category: CATEGORY_STANDARD,
  fallback_unit_per_order: true,
  notify_client: true,
  skip_threshold_days: true,
};

export const text = (value: any) => String(value ?? "").trim();
export const num = (value: any) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
export const round2 = (value: any) => Math.round(num(value) * 100) / 100;
const normKey = (value: any) => text(value).toUpperCase().replace(/^0+(?=\d)/, "");

function dedupe(list: any[]) {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const item of list || []) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

// --- Fechas del contrato -----------------------------------------------------

function caracasDayStart(value: any) {
  const d = new Date(new Date(value).getTime() - CARACAS_OFFSET_MS);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// Día del contrato: la fecha de emisión es el día 1, así que el cargo empieza el día 8.
export function storageDayNumber(invoiceDate: any, now: Date = new Date()) {
  if (!invoiceDate) return 0;
  return Math.floor((caracasDayStart(now) - caracasDayStart(invoiceDate)) / DAY_MS) + 1;
}

// Fecha local de Venezuela (YYYY-MM-DD) del momento de ejecución.
export function storageDayKey(value: any = new Date()) {
  const d = new Date(new Date(value).getTime() - CARACAS_OFFSET_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// --- Configuración ----------------------------------------------------------

export async function loadStorageConfig(base44: any) {
  const page = await base44.asServiceRole.entities.StorageChargeConfig
    .filter({ config_key: "main" }, { limit: 1 })
    .catch(() => ({ items: [] }));
  const found = (page?.items || [])[0];
  if (found) return { ...DEFAULT_STORAGE_CONFIG, ...found, id: found.id };
  const created = await base44.asServiceRole.entities.StorageChargeConfig
    .create({ ...DEFAULT_STORAGE_CONFIG })
    .catch(() => null);
  return { ...DEFAULT_STORAGE_CONFIG, ...(created || {}) };
}

// --- Unidades en almacén ----------------------------------------------------

// N° de orden/envío (invoice_number de CbmIngreso) que cubre la factura: los
// recibos guardados en la factura, los recibos facturados a su nombre y los
// N° de orden de sus líneas de envío. Es el mismo criterio con el que se arma la
// orden de almacén de una factura pagada.
export function invoiceOrderNumbers(invoice: any, receipts: any[] = []) {
  const numbers = new Set<string>();
  const push = (value: any) => {
    const n = text(value);
    if (n && n !== "—") numbers.add(n);
  };
  for (const recibo of Array.isArray(invoice?.manual_recibos) ? invoice.manual_recibos : []) {
    push(recibo?.invoice_number);
  }
  for (const recibo of receipts || []) push(recibo?.invoice_number);
  for (const item of Array.isArray(invoice?.items) ? invoice.items : []) {
    if (!/^env[íi]o/i.test(String(item?.description || ""))) continue;
    const sources = item?.details?.source_invoices;
    if (Array.isArray(sources) && sources.length) sources.forEach(push);
    else push(item?.details?.source_invoice);
  }
  return [...numbers];
}

// Volumen en CBM de cada paquete del bulto: manda el CBM registrado (actual_cbm)
// y, cuando no está, se calcula con las medidas (largo × ancho × alto en cm).
async function volumeOfPackages(base44: any, bultos: any[]) {
  const ids = [...new Set(
    (bultos || []).flatMap((b) => (Array.isArray(b.package_ids) ? b.package_ids : [])).filter(Boolean)
  )].slice(0, 300);
  const map: Record<string, number> = {};
  if (!ids.length) return map;
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += 100) batches.push(ids.slice(i, i + 100));
  const pages = await Promise.all(batches.map((batch) => base44.asServiceRole.entities.Package
    .filter(
      { id: { $in: batch } },
      { limit: 100, fields: ["actual_cbm", "actual_length_cm", "actual_width_cm", "actual_height_cm"] }
    )
    .catch(() => ({ items: [] }))));
  for (const page of pages) {
    for (const p of page?.items || []) {
      const registered = num(p.actual_cbm);
      const measured = (num(p.actual_length_cm) * num(p.actual_width_cm) * num(p.actual_height_cm)) / 1000000;
      map[p.id] = registered > 0 ? registered : measured;
    }
  }
  return map;
}

// Volumen del bulto en CBM: manda el CBM oficial registrado a mano y, si no hay,
// la suma del volumen de sus paquetes.
export function bultoVolumeCbm(bulto: any, packageVolume: Record<string, number> = {}) {
  const oficial = num(bulto?.cargo_cbm);
  if (oficial > 0) return oficial;
  return (Array.isArray(bulto?.package_ids) ? bulto.package_ids : [])
    .reduce((sum: number, id: string) => sum + num(packageVolume?.[id]), 0);
}

// Estándar o grande: manda la marca manual del bulto; si no hay, su volumen en
// CBM contra el máximo configurado y, cuando no hay volumen registrado, la regla
// configurable de caja consolidada / varios paquetes.
export function classifyBultoCategory(bulto: any, packageVolume: Record<string, number>, config: any) {
  const manual = text(bulto?.storage_category).toLowerCase();
  if (manual === CATEGORY_LARGE || manual === CATEGORY_STANDARD) return manual;

  const maxCbm = num(config?.standard_max_cbm) || num(DEFAULT_STORAGE_CONFIG.standard_max_cbm);
  if (bultoVolumeCbm(bulto, packageVolume) > maxCbm) return CATEGORY_LARGE;

  if (config?.large_if_multiple_packages !== false && (bulto?.is_caja || packageCountOfBulto(bulto) > 1)) {
    return CATEGORY_LARGE;
  }
  return text(config?.default_category) === CATEGORY_LARGE ? CATEGORY_LARGE : CATEGORY_STANDARD;
}

function fallbackUnit(orderNumber: string, config: any) {
  return {
    bulto_id: null,
    label_code: orderNumber,
    status: "",
    volume_cbm: 0,
    category: text(config?.default_category) === CATEGORY_LARGE ? CATEGORY_LARGE : CATEGORY_STANDARD,
    pallets: 0,
    requires_forklift: false,
    source: "envio",
    manual_category: "",
  };
}

// Unidades de una factura que permanecen en el almacén (los bultos despachados al
// cliente ya no ocupan espacio y dejan de cobrarse).
export async function resolveStorageUnits(base44: any, invoice: any, config: any) {
  const receiptsPage = await base44.asServiceRole.entities.CbmIngreso
    .filter({ billed_invoice_id: invoice.id }, { limit: 300, fields: ["invoice_number", "tracking_numbers"] })
    .catch(() => ({ items: [] }));
  const receipts = receiptsPage?.items || [];
  const orders = invoiceOrderNumbers(invoice, receipts);

  let bultos: any[] = [];
  const byInvoice = await base44.asServiceRole.entities.Bulto
    .filter({ billed_invoice_id: invoice.id }, { limit: 300 })
    .catch(() => ({ items: [] }));
  bultos = [...(byInvoice?.items || [])];

  if (orders.length) {
    const byOrder = await base44.asServiceRole.entities.Bulto
      .filter({ cbm_order_numbers: { $in: orders } }, { limit: 300 })
      .catch(() => ({ items: [] }));
    bultos = [...bultos, ...(byOrder?.items || [])];
  }

  bultos = dedupe(bultos);

  if (!bultos.length && invoice.client_email && orders.length) {
    const orderKeys = new Set(orders.map(normKey));
    const delCliente = await base44.asServiceRole.entities.Bulto
      .filter({ client_email: invoice.client_email }, { limit: 300 })
      .catch(() => ({ items: [] }));
    bultos = (delCliente?.items || []).filter((b: any) => (Array.isArray(b.cbm_order_numbers) ? b.cbm_order_numbers : [])
      .some((value: any) => orderKeys.has(normKey(value))));
  }

  // Sigue en el almacén todo lo que no se despachó al cliente. Un bulto facturado
  // en OTRA factura no se cobra aquí: el almacenamiento de esa carga lo lleva su
  // propia factura, y así un mismo bulto no se cuenta dos veces.
  const enAlmacen = bultos
    .filter((b) => text(b?.status) !== "despachado")
    .filter((b) => {
      const billed = text(b?.billed_invoice_id);
      return !billed || billed === text(invoice.id);
    });

  if (!enAlmacen.length) {
    if (config?.fallback_unit_per_order !== false && orders.length) {
      return {
        units: orders.map((order) => fallbackUnit(order, config)),
        source: "envio",
        bultos: 0,
        reason: null,
      };
    }
    return {
      units: [],
      source: "ninguna",
      bultos: 0,
      reason: "No se ubicaron bultos ni envíos en almacén para esta factura.",
    };
  }

  const packageVolume = await volumeOfPackages(base44, enAlmacen);
  const units = enAlmacen.map((b) => ({
    bulto_id: b.id,
    label_code: text(b.label_code) || `Bulto ${b.bulto_number ?? ""}`.trim() || b.id,
    status: text(b.status),
    volume_cbm: Math.round(bultoVolumeCbm(b, packageVolume) * 1000000) / 1000000,
    category: classifyBultoCategory(b, packageVolume, config),
    pallets: Math.max(0, Math.round(num(b.pallet_count))),
    requires_forklift: !!b.requiere_montacargas,
    source: "bulto",
    manual_category: text(b.storage_category).toLowerCase(),
  }));

  return { units, source: "bulto", bultos: units.length, reason: null };
}

// --- Cálculo del cargo ------------------------------------------------------

export function isStorageLine(item: any) {
  const kind = text(item?.details?.kind);
  return kind === STORAGE_LINE_KIND || kind === FORKLIFT_LINE_KIND;
}

// Días nuevos (nunca repite uno ya registrado), monto del día, palets que
// estrenan el recargo de montacargas y acumulado del contrato.
export function planInvoiceCharges({ invoice, units, charges, config, now = new Date() }: any) {
  const dayNumber = storageDayNumber(invoice?.invoice_date, now);
  const startDay = num(config?.free_days) + 1;
  const maxDay = num(config?.max_days) || 45;
  const records = Array.isArray(charges) ? charges : [];

  const lastChargedDay = records.reduce((max: number, r: any) => Math.max(max, num(r.day_number)), 0);
  const from = Math.max(startDay, lastChargedDay + 1);
  const to = Math.min(dayNumber, maxDay);
  const days: number[] = [];
  for (let d = from; d <= to; d += 1) days.push(d);

  const list = Array.isArray(units) ? units : [];
  const unitsStandard = list.filter((u: any) => u.category !== CATEGORY_LARGE).length;
  const unitsLarge = list.filter((u: any) => u.category === CATEGORY_LARGE).length;

  const rateStandard = num(config?.standard_daily_rate);
  const rateLarge = num(config?.large_daily_rate);
  const dailyAmount = round2(unitsStandard * rateStandard + unitsLarge * rateLarge);

  // El montacargas NO se cobra automáticamente: los palets marcados solo quedan
  // como referencia y el recargo lo aplica un administrador a mano desde el panel
  // de cargos (función applyStorageForklift).
  const palletsMarked = list.reduce(
    (sum: number, u: any) => sum + (u.requires_forklift ? Math.max(0, Math.round(num(u.pallets))) : 0),
    0
  );
  const palletsCharged = records.reduce((sum: number, r: any) => sum + num(r.forklift_pallets_today), 0);
  const newPallets = 0;

  const storageAmount = round2(days.length * dailyAmount);
  const forkliftAmount = 0;
  const amount = round2(storageAmount + forkliftAmount);

  // El aviso de fin de contrato (día tope alcanzado) se registra una sola vez.
  const stopNoticed = records.some((r: any) => String(r?.notes || "").includes("procedimiento contractual"));

  const accumulatedBefore = round2(records.reduce((sum: number, r: any) => sum + num(r.amount), 0));
  const storageAccumulatedBefore = round2(records.reduce((sum: number, r: any) => sum + num(r.storage_amount), 0));
  const forkliftAccumulatedBefore = round2(records.reduce((sum: number, r: any) => sum + num(r.forklift_amount), 0));

  const storageAccumulatedAfter = round2(storageAccumulatedBefore + storageAmount);
  const forkliftAccumulatedAfter = round2(forkliftAccumulatedBefore + forkliftAmount);
  const daysChargedAfter = Math.max(lastChargedDay, to >= from ? to : lastChargedDay);
  const totalBefore = num(invoice?.total);

  // Con los cargos en pausa el plan no mueve dinero: cero días nuevos, cero
  // monto y sin aviso de fin de contrato, así no se escribe nada en la factura.
  if (!STORAGE_CHARGES_ENABLED) {
    return {
      invoice_id: invoice?.id || null,
      invoice_number: text(invoice?.invoice_number),
      client_email: text(invoice?.client_email),
      status: text(invoice?.status),
      invoice_date: invoice?.invoice_date || null,
      day_number: dayNumber,
      start_day: startDay,
      max_day: maxDay,
      days: [],
      days_charged_after: lastChargedDay,
      units_standard: unitsStandard,
      units_large: unitsLarge,
      units_total: list.length,
      units_source: text(invoice?.units_source) || null,
      daily_rate_standard: rateStandard,
      daily_rate_large: rateLarge,
      daily_amount: 0,
      storage_amount: 0,
      forklift_pallets: 0,
      forklift_pallets_marked: palletsMarked,
      forklift_pallets_charged: palletsCharged,
      forklift_amount: 0,
      amount: 0,
      accumulated_before: accumulatedBefore,
      accumulated_after: accumulatedBefore,
      storage_accumulated_after: storageAccumulatedBefore,
      forklift_accumulated_after: forkliftAccumulatedBefore,
      pallets_charged_after: palletsCharged,
      total_before: totalBefore,
      total_after: totalBefore,
      stopped: false,
      stop_notice_created: true,
      changed: false,
    };
  }

  return {
    invoice_id: invoice?.id || null,
    invoice_number: text(invoice?.invoice_number),
    client_email: text(invoice?.client_email),
    status: text(invoice?.status),
    invoice_date: invoice?.invoice_date || null,
    day_number: dayNumber,
    start_day: startDay,
    max_day: maxDay,
    days,
    days_charged_after: daysChargedAfter,
    units_standard: unitsStandard,
    units_large: unitsLarge,
    units_total: list.length,
    units_source: text(invoice?.units_source) || null,
    daily_rate_standard: rateStandard,
    daily_rate_large: rateLarge,
    daily_amount: dailyAmount,
    storage_amount: storageAmount,
    forklift_pallets: newPallets,
    forklift_pallets_marked: palletsMarked,
    forklift_pallets_charged: palletsCharged,
    forklift_amount: forkliftAmount,
    amount,
    accumulated_before: accumulatedBefore,
    accumulated_after: round2(accumulatedBefore + amount),
    storage_accumulated_after: storageAccumulatedAfter,
    forklift_accumulated_after: forkliftAccumulatedAfter,
    pallets_charged_after: palletsCharged + newPallets,
    total_before: totalBefore,
    total_after: round2(totalBefore + amount),
    stopped: dayNumber > maxDay,
    stop_notice_created: stopNoticed,
    changed: amount >= 0.01,
  };
}

// Cómo queda la factura: se reemplazan solo las líneas de almacenamiento y
// montacargas y el total se mueve por la diferencia, así el resto de la factura
// (envío, seguro, consolidación, puerta a puerta) queda intacto.
export function applyStorageLines(invoice: any, plan: any, units: any[]) {
  const items = Array.isArray(invoice?.items) ? invoice.items : [];
  const others = items.filter((item: any) => !isStorageLine(item));
  const previousTotal = round2(items.filter(isStorageLine).reduce((sum: number, item: any) => sum + num(item.total), 0));

  const now = new Date().toISOString();
  const lines: any[] = [];

  if (plan.storage_accumulated_after > 0) {
    const days = Math.max(1, num(plan.days_charged_after) - plan.start_day + 1);
    const toDay = num(plan.days_charged_after);
    const rateStandard = num(plan.daily_rate_standard);
    const rateLarge = num(plan.daily_rate_large);
    const unitsStandard = num(plan.units_standard);
    const unitsLarge = num(plan.units_large);

    // Cada tipo de bulto va en su propia línea con la tarifa diaria aprobada
    // como precio unitario y los bulto-día como cantidad (bultos × días), para
    // que el almacenamiento nunca se confunda con el recargo de montacargas.
    const computedStandard = round2(unitsStandard * rateStandard * days);
    const computedLarge = round2(unitsLarge * rateLarge * days);
    const computed = round2(computedStandard + computedLarge);
    const factor = computed > 0 ? num(plan.storage_accumulated_after) / computed : 0;

    const storageLine = (category: string, units: number, amount: number) => {
      const quantity = Math.max(1, units * days);
      lines.push({
        description: `Almacenamiento y custodia · bultos ${category} (día ${plan.start_day} al ${toDay})`,
        quantity,
        unit_price: round2(amount / quantity),
        total: round2(amount),
        details: {
          kind: STORAGE_LINE_KIND,
          category: category === "grandes" ? CATEGORY_LARGE : CATEGORY_STANDARD,
          days,
          from_day: plan.start_day,
          to_day: toDay,
          units,
          rate: category === "grandes" ? rateLarge : rateStandard,
          daily_amount: round2(units * (category === "grandes" ? rateLarge : rateStandard)),
          updated_date: now,
        },
      });
    };

    if (unitsStandard > 0) storageLine("estándar", unitsStandard, computedStandard * factor);
    if (unitsLarge > 0) storageLine("grandes", unitsLarge, computedLarge * factor);
    if (!unitsStandard && !unitsLarge) {
      lines.push({
        description: `Almacenamiento y custodia (día ${plan.start_day} al ${toDay})`,
        quantity: days,
        unit_price: round2(num(plan.storage_accumulated_after) / days),
        total: round2(plan.storage_accumulated_after),
        details: {
          kind: STORAGE_LINE_KIND,
          days,
          from_day: plan.start_day,
          to_day: toDay,
          daily_amount: plan.daily_amount,
          rate_standard: rateStandard,
          rate_large: rateLarge,
          updated_date: now,
        },
      });
    }
  }

  if (plan.forklift_accumulated_after > 0) {
    const pallets = Math.max(1, num(plan.pallets_charged_after));
    lines.push({
      description: `Uso de montacargas (${pallets} palet${pallets === 1 ? "" : "s"})`,
      quantity: pallets,
      unit_price: round2(plan.forklift_accumulated_after / pallets),
      total: round2(plan.forklift_accumulated_after),
      details: {
        kind: FORKLIFT_LINE_KIND,
        pallets,
        charged_once: true,
        updated_date: now,
      },
    });
  }

  const newTotal = round2(lines.reduce((sum: number, line: any) => sum + line.total, 0));
  const delta = round2(newTotal - previousTotal);
  const unitsSnapshot = (Array.isArray(units) ? units : []).map((u: any) => ({
    label_code: u.label_code,
    category: u.category,
    pallets: num(u.pallets),
    requires_forklift: !!u.requires_forklift,
    source: u.source,
  }));

  return {
    items: [...others, ...lines],
    lines,
    delta,
    subtotal: round2(num(invoice?.subtotal) + delta),
    total: round2(num(invoice?.total) + delta),
    units_snapshot: unitsSnapshot,
  };
}

// Registros que se guardan para auditoría: un renglón por día nuevo cobrado,
// con el recargo de montacargas en el último (o en su propio renglón cuando no
// hay días nuevos pero se marcó un palet).
export function buildChargeRecords(plan: any, units: any[], options: any = {}) {
  const createdBy = text(options.createdBy) || "sistema (automático)";
  const chargeDate = text(options.chargeDate) || storageDayKey();
  const snapshot = (Array.isArray(units) ? units : []).map((u: any) => ({
    label_code: u.label_code,
    category: u.category,
    pallets: num(u.pallets),
    requires_forklift: !!u.requires_forklift,
    source: u.source,
  }));

  const records: any[] = [];
  let running = num(plan.accumulated_before);

  plan.days.forEach((day: number, index: number) => {
    const isLast = index === plan.days.length - 1;
    const forkliftAmount = isLast ? num(plan.forklift_amount) : 0;
    const amount = round2(num(plan.daily_amount) + forkliftAmount);
    running = round2(running + amount);
    records.push({
      invoice_id: plan.invoice_id,
      invoice_number: plan.invoice_number,
      client_email: plan.client_email,
      charge_date: chargeDate,
      day_number: day,
      covered_days: [day],
      days_count: 1,
      units_standard: plan.units_standard,
      units_large: plan.units_large,
      units_source: options.unitsSource || "bulto",
      units_snapshot: snapshot,
      daily_rate_standard: plan.daily_rate_standard,
      daily_rate_large: plan.daily_rate_large,
      daily_amount: plan.daily_amount,
      storage_amount: plan.daily_amount,
      forklift_pallets_today: isLast ? num(plan.forklift_pallets) : 0,
      forklift_amount: forkliftAmount,
      amount,
      accumulated_amount: running,
      invoice_total_before: round2(plan.total_before + (running - num(plan.accumulated_before) - amount)),
      invoice_total_after: round2(plan.total_before + (running - num(plan.accumulated_before))),
      notified: false,
      created_by: createdBy,
      notes: "",
    });
  });

  if (!records.length && num(plan.forklift_amount) > 0) {
    const amount = round2(num(plan.forklift_amount));
    running = round2(running + amount);
    records.push({
      invoice_id: plan.invoice_id,
      invoice_number: plan.invoice_number,
      client_email: plan.client_email,
      charge_date: chargeDate,
      day_number: num(plan.day_number),
      covered_days: [],
      days_count: 0,
      units_standard: plan.units_standard,
      units_large: plan.units_large,
      units_source: options.unitsSource || "bulto",
      units_snapshot: snapshot,
      daily_rate_standard: plan.daily_rate_standard,
      daily_rate_large: plan.daily_rate_large,
      daily_amount: 0,
      storage_amount: 0,
      forklift_pallets_today: num(plan.forklift_pallets),
      forklift_amount: amount,
      amount,
      accumulated_amount: running,
      invoice_total_before: round2(num(plan.total_before)),
      invoice_total_after: round2(num(plan.total_before) + amount),
      notified: false,
      created_by: createdBy,
      notes: "Recargo único de montacargas por palet marcado; no hay días nuevos de almacenamiento.",
    });
  }

  if (plan.stopped && !plan.stop_notice_created) {
    records.push({
      invoice_id: plan.invoice_id,
      invoice_number: plan.invoice_number,
      client_email: plan.client_email,
      charge_date: chargeDate,
      day_number: plan.day_number,
      covered_days: [],
      days_count: 0,
      units_standard: plan.units_standard,
      units_large: plan.units_large,
      units_source: "ninguna",
      units_snapshot: [],
      daily_rate_standard: plan.daily_rate_standard,
      daily_rate_large: plan.daily_rate_large,
      daily_amount: 0,
      storage_amount: 0,
      forklift_pallets_today: 0,
      forklift_amount: 0,
      amount: 0,
      accumulated_amount: round2(plan.accumulated_after),
      invoice_total_before: num(plan.total_before),
      invoice_total_after: num(plan.total_before),
      notified: false,
      created_by: createdBy,
      notes: `Día ${plan.day_number}: pasó el día ${plan.max_day} del contrato, los cargos de almacenamiento se detienen y corresponde revisar el procedimiento contractual.`,
    });
  }

  return records;
}

// Texto del desglose que ve el cliente (sin llamarlo penalización por mora).
export function chargeBreakdownText(plan: any) {
  const parts: string[] = [];
  const standard = `• Bultos estándar: ${plan.units_standard} × $${num(plan.daily_rate_standard).toFixed(2)} = $${round2(plan.units_standard * plan.daily_rate_standard).toFixed(2)} diarios`;
  const large = `• Bultos grandes: ${plan.units_large} × $${num(plan.daily_rate_large).toFixed(2)} = $${round2(plan.units_large * plan.daily_rate_large).toFixed(2)} diarios`;
  parts.push(standard, large);
  if (plan.days.length) {
    parts.push(`• Días de almacenamiento cobrados ahora: ${plan.days.length} (día ${plan.days[0]} al ${plan.days[plan.days.length - 1]}) = $${round2(plan.storage_amount).toFixed(2)}`);
  }
  if (num(plan.forklift_amount) > 0) {
    parts.push(`• Uso de montacargas: ${plan.forklift_pallets} palet(s) × $${num(plan.forklift_fee || 0).toFixed(2)} = $${round2(plan.forklift_amount).toFixed(2)} (recargo único por palet)`);
  }
  parts.push(`• Total agregado a la factura: $${round2(plan.amount).toFixed(2)}`);
  parts.push(`• Acumulado de almacenamiento y custodia: $${round2(plan.accumulated_after).toFixed(2)}`);
  return parts.join("\n");
}