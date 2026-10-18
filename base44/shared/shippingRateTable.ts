// Tarifas vigentes para el asistente de soporte (ATC).
//
// No define tarifas propias: lee EXACTAMENTE las mismas fuentes y aplica las
// mismas reglas que la calculadora de envíos:
//   - PricingConfig: tarifa base, utilidad y costo puerta a puerta.
//   - StateConfig:   tarifa del estado de destino (y tarifa final cuando está definida).
//   - AppConfig:     tarifas fijas para cargas menores a 0.130 CBM.
//
// Reglas:
//   - Cargas desde 0.130 CBM: se cobra por CBM con la tarifa del estado de destino.
//   - Cargas menores a 0.130 CBM: tarifa fija por rango.
//   - Desde 400 kg inclusive: la tarifa por CBM se cobra al doble (x2).
import { num } from './paginatedFetch.ts';

export const DOOR_TO_DOOR_THRESHOLD = 0.130;
export const RECEPTION_FEE_USD = 1;
// Desde este peso (inclusive) la tarifa por CBM se cobra al doble.
export const WEIGHT_DOUBLE_FROM_KG = 400;

const round2 = (v: any) => Math.round(num(v) * 100) / 100;

function norm(value: any) {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Configuración de la que salen las tarifas (una sola lectura por corrida).
export async function loadShippingRateBase(base44: any) {
  const [pricingRes, statesRes, configRes] = await Promise.all([
    base44.asServiceRole.entities.PricingConfig.filter({ config_key: 'main' }, '-updated_date', 1).catch(() => []),
    base44.asServiceRole.entities.StateConfig.filter({ is_active: true }, 'state_name', 30).catch(() => []),
    base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1).catch(() => []),
  ]);
  return {
    pricing: (pricingRes || [])[0] || null,
    states: statesRes || [],
    appConfig: (configRes || [])[0] || null,
  };
}

// Tarifa por CBM (regular y alto riesgo) del estado de destino, con la misma
// fórmula de la calculadora: la tarifa final del estado manda si está definida.
export function stateRatesFor(state: any, pricing: any) {
  const profit = num(pricing?.profit_percentage) / 100;
  const door = num(pricing?.door_to_door_cost);
  const shippingRate = num(state?.shipping_rate);
  const finalRegular = num(state?.final_rate_regular);
  const finalHigh = num(state?.final_rate_high);
  return {
    regular: finalRegular > 0 ? finalRegular : num(pricing?.base_rate_regular) * (1 + profit) + shippingRate + door,
    high: finalHigh > 0 ? finalHigh : num(pricing?.base_rate_high_risk) * (1 + profit) + shippingRate + door,
  };
}

// Tabla lista para el asistente: tarifa por CBM de cada destino y las tarifas
// fijas de las cargas menores a 0.130 CBM.
export function buildShippingRateTable({ pricing, states, appConfig }: any) {
  const porEstado = (states || [])
    .filter((s: any) => s?.is_active !== false)
    .map((s: any) => {
      const rates = stateRatesFor(s, pricing);
      return {
        estado: s.state_name,
        codigo: s.state_code,
        tarifa_cbm_regular: round2(rates.regular),
        tarifa_cbm_alto_riesgo: round2(rates.high),
      };
    })
    .sort((a: any, b: any) => String(a.estado).localeCompare(String(b.estado)));

  const fijas = [...(Array.isArray(appConfig?.special_cbm_rates) ? appConfig.special_cbm_rates : [])]
    .sort((x: any, y: any) => num(x.min_cbm) - num(y.min_cbm))
    .map((r: any) => ({
      desde_cbm: num(r.min_cbm),
      hasta_cbm: num(r.max_cbm),
      tarifa_regular: num(r.rate_regular),
      tarifa_alto_riesgo: num(r.rate_high_risk),
    }));

  return {
    fuente: 'Mismas fuentes que la calculadora: PricingConfig, StateConfig y AppConfig.',
    regla_peso: `Desde ${WEIGHT_DOUBLE_FROM_KG} kg inclusive la tarifa por CBM se cobra al doble (x2). Ejemplo: tarifa regular 10 USD/CBM con 400 kg o más = 20 USD/CBM.`,
    regla_tarifa_fija: `Cargas menores a ${DOOR_TO_DOOR_THRESHOLD} CBM: se cobra la tarifa fija del rango que corresponda, no por CBM.`,
    recepcion_usd_por_paquete: RECEPTION_FEE_USD,
    seguro_porcentaje_fob: num(appConfig?.insurance_percentage) || null,
    tarifa_por_cbm_por_estado: porEstado,
    tarifas_fijas_bajo_0_130_cbm: fijas,
  };
}

// Fila de la tabla que corresponde al estado del cliente (código o nombre).
export function findStateRate(rateTable: any, state: any) {
  const target = norm(state);
  if (!target) return null;
  const found = (rateTable?.tarifa_por_cbm_por_estado || []).find(
    (r: any) => norm(r.codigo) === target || norm(r.estado) === target,
  );
  return found || null;
}