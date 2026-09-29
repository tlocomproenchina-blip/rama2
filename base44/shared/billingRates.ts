// Tarifas de envío reutilizables en el backend.
//
// Replica —en un módulo compartido— la misma regla que usa la pantalla de
// Facturación Manual (AdminManualBilling): la tarifa del recibo se resuelve por
// su fecha (RateHistory), el tipo de carga (general / alto_riesgo) y el estado
// del cliente, y el envío de una factura se calcula consolidado sobre el CBM
// facturado total. Se usa para recalcular una factura cuando se fusionan
// recibos duplicados.
import { num } from "./paginatedFetch.ts";

export const DOOR_TO_DOOR_THRESHOLD = 0.130;

export const round2 = (v: any) => Math.round(num(v) * 100) / 100;
export const round5 = (v: any) => Math.round(num(v) * 1e5) / 1e5;

function toDate(v: any) {
  if (!v) return null;
  const d = new Date(String(v).includes("T") ? v : `${v}T12:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

// Configuración global de la que dependen las tarifas (una sola lectura por corrida).
export async function loadRateBase(base44: any) {
  const [cfgs, prcs, states, history] = await Promise.all([
    base44.asServiceRole.entities.AppConfig.filter({ config_key: "main" }, "-updated_date", 1).catch(() => []),
    base44.asServiceRole.entities.PricingConfig.filter({ config_key: "main" }, "-updated_date", 1).catch(() => []),
    base44.asServiceRole.entities.StateConfig.list("-updated_date", 200).catch(() => []),
    base44.asServiceRole.entities.RateHistory.list("-effective_date", 200).catch(() => []),
  ]);
  return {
    appConfig: (cfgs || [])[0] || null,
    pricing: (prcs || [])[0] || null,
    states: states || [],
    rateHistory: history || [],
  };
}

// Estado (`state`) de cada cliente implicado: de ahí sale la tarifa por CBM del estado.
export async function loadClientStates(base44: any, emails: string[]) {
  const out: Record<string, string> = {};
  const list = [...new Set((emails || []).filter(Boolean))];
  if (!list.length) return out;
  const users = await base44.asServiceRole.entities.User
    .filter({ email: { $in: list } }, undefined, list.length + 10)
    .catch(() => []);
  for (const u of users || []) {
    if (u?.email) out[u.email] = String(u.state || "").trim().toLowerCase();
  }
  return out;
}

export function stateShippingRateFor(rateBase: any, stateCode: string) {
  const code = String(stateCode || "").trim().toLowerCase();
  if (!code) return 0;
  const found = (rateBase?.states || []).find((s: any) => String(s.state_code).trim().toLowerCase() === code);
  return num(found?.shipping_rate);
}

export function buildRateContext({ appConfig, pricing, rateHistory, stateShippingRate }: any) {
  const specials = Array.isArray(appConfig?.special_cbm_rates) ? appConfig.special_cbm_rates : [];
  const currentRateSet = {
    base_rate_regular: num(pricing?.base_rate_regular),
    base_rate_high_risk: num(pricing?.base_rate_high_risk),
    profit_percentage: num(pricing?.profit_percentage),
    door_to_door_cost: num(pricing?.door_to_door_cost),
    special_cbm_rates: [...specials].sort((x: any, y: any) => num(x.min_cbm) - num(y.min_cbm)),
    effective_date: null,
  };
  const history = [...(rateHistory || [])].sort(
    (a: any, b: any) => (toDate(a.effective_date)?.getTime() || 0) - (toDate(b.effective_date)?.getTime() || 0)
  );
  return { currentRateSet, history, stateShippingRate: num(stateShippingRate) };
}

// Set de tarifas vigente para la fecha del recibo (o el actual si no hay historial).
export function rateSetForDate(ctx: any, fecha: any) {
  const d = toDate(fecha);
  if (!d || !ctx?.history?.length) return ctx.currentRateSet;
  let chosen: any = null;
  for (const r of ctx.history) {
    const ed = toDate(r.effective_date);
    if (!ed) continue;
    if (ed.getTime() <= d.getTime()) chosen = r;
    else break;
  }
  if (!chosen) return ctx.currentRateSet;
  return {
    base_rate_regular: num(chosen.base_rate_regular),
    base_rate_high_risk: num(chosen.base_rate_high_risk),
    profit_percentage: num(chosen.profit_percentage),
    door_to_door_cost: num(chosen.door_to_door_cost),
    special_cbm_rates: Array.isArray(chosen.special_cbm_rates) ? chosen.special_cbm_rates : [],
    effective_date: chosen.effective_date,
  };
}

// Precio por CBM para cargas >= 0.130 CBM.
export function ratePerCbmFor(ctx: any, rateSet: any, type: string) {
  const baseRate = type === "alto_riesgo" ? rateSet?.base_rate_high_risk : rateSet?.base_rate_regular;
  return num(baseRate) * (1 + num(rateSet?.profit_percentage) / 100)
    + num(ctx?.stateShippingRate)
    + num(rateSet?.door_to_door_cost);
}

// Tarifa fija de la tabla de mínimos (< 0.130 CBM), o null si el rango no existe.
export function specialRateFor(rateSet: any, type: string, cbm: number) {
  const sorted = [...(rateSet?.special_cbm_rates || [])].sort((x: any, y: any) => num(x.min_cbm) - num(y.min_cbm));
  const found = sorted.find((r: any) => num(cbm) <= num(r.max_cbm));
  if (!found) return null;
  return type === "alto_riesgo" ? num(found.rate_high_risk) : num(found.rate_regular);
}

// Precio por CBM del recibo según su fecha y tipo de carga.
export function rateForReceipt(ctx: any, fecha: any, type: string) {
  return ratePerCbmFor(ctx, rateSetForDate(ctx, fecha), type);
}

// Envío consolidado de una factura: un solo cálculo sobre el CBM facturado total.
// Misma regla que calcConsolidatedShipping en AdminManualBilling.
export function consolidatedShipping(ctx: any, billedCbm: number, receipts: any[], fallbackType = "general") {
  const c = num(billedCbm);
  if (c <= 0) return 0;
  const typeOf = (r: any) => (r?.type || r?.cargo_type || fallbackType);

  if (c >= DOOR_TO_DOOR_THRESHOLD) {
    const totalReceiptCbm = (receipts || []).reduce((s: number, r: any) => s + num(r.cbm), 0);
    if (totalReceiptCbm <= 0) return c * ratePerCbmFor(ctx, ctx.currentRateSet, fallbackType);
    const groups: Record<string, any> = {};
    for (const r of receipts || []) {
      if (num(r.cbm) <= 0) continue;
      const type = typeOf(r);
      const rs = rateSetForDate(ctx, r.fecha);
      const key = `${rs.effective_date || "current"}|${type}`;
      if (!groups[key]) groups[key] = { rateSet: rs, type, cbm: 0 };
      groups[key].cbm += num(r.cbm);
    }
    const scale = c / totalReceiptCbm;
    return Object.values(groups).reduce(
      (sum: number, g: any) => sum + g.cbm * scale * ratePerCbmFor(ctx, g.rateSet, g.type),
      0
    );
  }

  const withDates = (receipts || []).filter((r: any) => !!toDate(r.fecha));
  const ref = withDates.length
    ? withDates.reduce((max: any, r: any) => (toDate(r.fecha) as Date) > (toDate(max.fecha) as Date) ? r : max)
    : null;
  const rateSet = ref ? rateSetForDate(ctx, ref.fecha) : ctx.currentRateSet;
  const type = ref ? typeOf(ref) : fallbackType;
  const fixed = specialRateFor(rateSet, type, c);
  return fixed === null ? 0 : fixed;
}

// Etiqueta 'actual' / 'anterior' del set de tarifas aplicado (solo informativo).
export function rateLabelFor(ctx: any, fecha: any) {
  if (!fecha || !ctx?.history?.length) return "actual";
  const latest = [...ctx.history].sort(
    (a: any, b: any) => (toDate(b.effective_date)?.getTime() || 0) - (toDate(a.effective_date)?.getTime() || 0)
  )[0];
  const resolved = rateSetForDate(ctx, fecha);
  if (resolved?.effective_date && latest?.effective_date
    && (toDate(resolved.effective_date) as Date) < (toDate(latest.effective_date) as Date)) {
    return "anterior";
  }
  return "actual";
}