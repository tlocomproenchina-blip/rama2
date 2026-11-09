// Cargos de almacenamiento y custodia de las facturas impagas.
//
// Reglas del contrato (Términos, sección VII):
//   - Días 1 al 7 (el día 1 es el siguiente a la emisión): almacenamiento gratuito.
//   - Día 8: cargo fijo único de USD 100 por factura.
//   - Desde el día 9: USD 20 por cada día continuo, por factura.
//   - Ya no se cobra por tamaño de bulto (tarifas de USD 10/20 por bulto descontinuadas).
//   - El montacargas (USD 150 por uso) se aplica aparte en la factura y el
//     proceso automático no lo toca.
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

// Interruptor general (StorageChargeConfig.charges_enabled): apagado por defecto.
// Mientras está apagado no se generan ni se aplican cargos nuevos a las
// facturas; los registros históricos y las líneas ya guardadas se conservan.
export const storageChargesEnabled = (config: any) => config?.charges_enabled === true;

export const DEFAULT_STORAGE_CONFIG: Record<string, any> = {
  config_key: "main",
  charges_enabled: false,
  is_active: true,
  free_days: 7,
  max_days: 45,
  fixed_fee: 100,
  daily_rate: 20,
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

// Día del contrato: igual que los Términos, el día de emisión es 0 y el siguiente
// es el día 1, así que el cargo fijo llega el día 8.
export function storageDayNumber(invoiceDate: any, now: Date = new Date()) {
  if (!invoiceDate) return 0;
  return Math.floor((caracasDayStart(now) - caracasDayStart(invoiceDate)) / DAY_MS);
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

export const CHARGE_TYPE_FIXED = "cargo_fijo";
export const CHARGE_TYPE_DAILY = "almacenamiento_diario";
export const CHARGE_TYPE_FORKLIFT = "montacargas";
export const CHARGE_TYPE_NOTICE = "aviso";

// Registros que cuentan como almacenamiento con la regla vigente. Los registros
// anteriores (tarifa por tamaño de bulto) no tienen tipo y no se toman en cuenta.
const isStorageRecord = (r: any) => {
  const type = text(r?.charge_type);
  return type === CHARGE_TYPE_FIXED || type === CHARGE_TYPE_DAILY;
};

const recordDays = (r: any) => (Array.isArray(r?.covered_days) && r.covered_days.length ? r.covered_days : [r?.day_number])
  .map(num)
  .filter((d: number) => d > 0);

// Línea de almacenamiento de la factura (las de montacargas NO entran aquí: se
// aplican aparte en la factura y nunca se reemplazan).
export function isStorageLine(item: any) {
  if (text(item?.details?.kind) === STORAGE_LINE_KIND) return true;
  return text(item?.description).toLowerCase().startsWith("almacenamiento y custodia");
}

// Días nuevos (nunca repite uno ya registrado): el día 8 lleva el cargo fijo y
// cada día siguiente la tarifa diaria. El monto no depende de los bultos.
export function planInvoiceCharges({ invoice, charges, config, now = new Date() }: any) {
  const dayNumber = storageDayNumber(invoice?.invoice_date, now);
  const startDay = num(config?.free_days) + 1;
  const maxDay = num(config?.max_days) || 45;
  const fixedFee = num(config?.fixed_fee ?? DEFAULT_STORAGE_CONFIG.fixed_fee);
  const dailyRate = num(config?.daily_rate ?? DEFAULT_STORAGE_CONFIG.daily_rate);
  const all = Array.isArray(charges) ? charges : [];
  const records = all.filter(isStorageRecord);

  const lastChargedDay = records.reduce((max: number, r: any) => Math.max(max, ...recordDays(r)), 0);
  const from = Math.max(startDay, lastChargedDay + 1);
  const to = Math.min(dayNumber, maxDay);
  const enabled = storageChargesEnabled(config);
  const days: number[] = [];
  if (enabled) for (let d = from; d <= to; d += 1) days.push(d);

  const fixedAmount = days.includes(startDay) ? round2(fixedFee) : 0;
  const dailyDays = days.filter((d) => d !== startDay).length;
  const dailyAmount = round2(dailyDays * dailyRate);
  const amount = round2(fixedAmount + dailyAmount);

  const sumOf = (type: string) => round2(records
    .filter((r: any) => text(r.charge_type) === type)
    .reduce((sum: number, r: any) => sum + num(r.storage_amount), 0));
  const dailyDaysBefore = records
    .filter((r: any) => text(r.charge_type) === CHARGE_TYPE_DAILY)
    .reduce((sum: number, r: any) => sum + recordDays(r).length, 0);

  const accumulatedBefore = round2(records.reduce((sum: number, r: any) => sum + num(r.amount), 0));
  const stopNoticed = all.some((r: any) => text(r?.charge_type) === CHARGE_TYPE_NOTICE
    || String(r?.notes || "").includes("procedimiento contractual"));
  const totalBefore = num(invoice?.total);

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
    days_charged_after: days.length ? days[days.length - 1] : lastChargedDay,
    fixed_fee: fixedFee,
    daily_rate: dailyRate,
    fixed_amount: fixedAmount,
    daily_days: dailyDays,
    daily_amount: dailyAmount,
    storage_amount: amount,
    amount,
    fixed_accumulated_after: round2(sumOf(CHARGE_TYPE_FIXED) + fixedAmount),
    daily_accumulated_after: round2(sumOf(CHARGE_TYPE_DAILY) + dailyAmount),
    daily_days_after: dailyDaysBefore + dailyDays,
    accumulated_before: accumulatedBefore,
    accumulated_after: round2(accumulatedBefore + amount),
    total_before: totalBefore,
    total_after: round2(totalBefore + amount),
    // Con los cargos en pausa no se registra ni el aviso de fin de contrato.
    stopped: enabled && dayNumber > maxDay,
    stop_notice_created: !enabled || stopNoticed,
    changed: amount >= 0.01,
  };
}

// Cómo queda la factura: se reemplazan solo las líneas de almacenamiento (cargo
// fijo y diario) y el total se mueve por la diferencia. El montacargas y el resto
// de la factura (envío, seguro, consolidación, puerta a puerta) quedan intactos.
export function applyStorageLines(invoice: any, plan: any) {
  const items = Array.isArray(invoice?.items) ? invoice.items : [];
  const others = items.filter((item: any) => !isStorageLine(item));
  const previousTotal = round2(items.filter(isStorageLine).reduce((sum: number, item: any) => sum + num(item.total), 0));
  const now = new Date().toISOString();
  const lines: any[] = [];

  if (plan.fixed_accumulated_after > 0) {
    lines.push({
      description: `Almacenamiento y custodia · cargo fijo (día ${plan.start_day})`,
      quantity: 1,
      unit_price: round2(plan.fixed_accumulated_after),
      total: round2(plan.fixed_accumulated_after),
      details: { kind: STORAGE_LINE_KIND, charge_type: CHARGE_TYPE_FIXED, day: plan.start_day, updated_date: now },
    });
  }

  if (plan.daily_accumulated_after > 0) {
    const days = Math.max(1, num(plan.daily_days_after));
    const fromDay = plan.start_day + 1;
    const toDay = num(plan.days_charged_after);
    lines.push({
      description: `Almacenamiento y custodia · diario (día ${fromDay} al ${toDay})`,
      quantity: days,
      unit_price: round2(plan.daily_accumulated_after / days),
      total: round2(plan.daily_accumulated_after),
      details: {
        kind: STORAGE_LINE_KIND,
        charge_type: CHARGE_TYPE_DAILY,
        days,
        from_day: fromDay,
        to_day: toDay,
        rate: plan.daily_rate,
        updated_date: now,
      },
    });
  }

  const newTotal = round2(lines.reduce((sum: number, line: any) => sum + line.total, 0));
  const delta = round2(newTotal - previousTotal);
  return {
    items: [...others, ...lines],
    lines,
    delta,
    subtotal: round2(num(invoice?.subtotal) + delta),
    total: round2(num(invoice?.total) + delta),
  };
}

// Registros para el historial de cobros: un renglón por día nuevo, identificado
// como cargo fijo (día 8) o almacenamiento diario, más el aviso de fin de contrato.
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
  const base = {
    invoice_id: plan.invoice_id,
    invoice_number: plan.invoice_number,
    client_email: plan.client_email,
    charge_date: chargeDate,
    units_standard: 0,
    units_large: 0,
    units_snapshot: snapshot,
    forklift_pallets_today: 0,
    forklift_amount: 0,
    notified: false,
    created_by: createdBy,
  };

  const records: any[] = [];
  let running = num(plan.accumulated_before);
  let invoiceTotal = num(plan.total_before);

  for (const day of plan.days) {
    const isFixed = day === plan.start_day;
    const amount = round2(isFixed ? plan.fixed_fee : plan.daily_rate);
    running = round2(running + amount);
    records.push({
      ...base,
      charge_type: isFixed ? CHARGE_TYPE_FIXED : CHARGE_TYPE_DAILY,
      day_number: day,
      covered_days: [day],
      days_count: 1,
      units_source: options.unitsSource || "ninguna",
      daily_amount: isFixed ? 0 : amount,
      storage_amount: amount,
      amount,
      accumulated_amount: running,
      invoice_total_before: round2(invoiceTotal),
      invoice_total_after: round2(invoiceTotal + amount),
      notes: isFixed ? `Cargo fijo de almacenamiento y custodia (día ${day}).` : `Almacenamiento diario (día ${day}).`,
    });
    invoiceTotal += amount;
  }

  if (plan.stopped && !plan.stop_notice_created) {
    records.push({
      ...base,
      charge_type: CHARGE_TYPE_NOTICE,
      day_number: plan.day_number,
      covered_days: [],
      days_count: 0,
      units_source: "ninguna",
      units_snapshot: [],
      daily_amount: 0,
      storage_amount: 0,
      amount: 0,
      accumulated_amount: round2(plan.accumulated_after),
      invoice_total_before: round2(invoiceTotal),
      invoice_total_after: round2(invoiceTotal),
      notes: `Día ${plan.day_number}: pasó el día ${plan.max_day} del contrato, los cargos de almacenamiento se detienen y corresponde revisar el procedimiento contractual.`,
    });
  }

  return records;
}

// Texto del desglose que ve el cliente (sin llamarlo penalización por mora).
export function chargeBreakdownText(plan: any) {
  const parts: string[] = [];
  if (num(plan.fixed_amount) > 0) {
    parts.push(`• Cargo fijo de almacenamiento (día ${plan.start_day}): $${round2(plan.fixed_amount).toFixed(2)}`);
  }
  if (num(plan.daily_days) > 0) {
    const dailyDays = plan.days.filter((d: number) => d !== plan.start_day);
    parts.push(`• Almacenamiento diario: ${plan.daily_days} día(s) × $${num(plan.daily_rate).toFixed(2)} (día ${dailyDays[0]} al ${dailyDays[dailyDays.length - 1]}) = $${round2(plan.daily_amount).toFixed(2)}`);
  }
  parts.push(`• Total agregado a la factura: $${round2(plan.amount).toFixed(2)}`);
  parts.push(`• Acumulado de almacenamiento y custodia: $${round2(plan.accumulated_after).toFixed(2)}`);
  return parts.join("\n");
}