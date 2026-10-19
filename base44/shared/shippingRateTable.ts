// Tarifas vigentes para el asistente de soporte (ATC).
//
// No define tarifas propias: lee EXACTAMENTE las mismas fuentes y aplica las
// mismas reglas que la calculadora de envíos:
//   - PricingConfig: tarifa base, utilidad y costo puerta a puerta.
//   - StateConfig:   tarifa del estado de destino (y tarifa final cuando está definida).
//   - AppConfig:     porcentaje del seguro de carga.
//
// Reglas:
//   - No hay mínimo de envío: toda la carga se cobra por su volumen real en CBM
//     con la tarifa del estado de destino. No existe tarifa fija por rango.
//   - Hasta 399 kg la tarifa por CBM se cobra normal; desde 400 kg inclusive se
//     cobra al doble (x2), en carga regular y en carga de alto riesgo / sensible.
import { num } from './paginatedFetch.ts';

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

// Tabla lista para el asistente: tarifa por CBM de cada destino.
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

  return {
    fuente: 'Mismas fuentes que la calculadora: PricingConfig, StateConfig y AppConfig.',
    regla_calculo: 'No hay mínimo de envío: toda la carga se cobra por su volumen real en CBM multiplicado por la tarifa por CBM del estado de destino. No existe tarifa fija por rango ni monto mínimo por volumen pequeño.',
    regla_peso: `Hasta 399 kg la tarifa por CBM se cobra normal; desde ${WEIGHT_DOUBLE_FROM_KG} kg inclusive se cobra al doble (x2), tanto en carga regular como en carga de alto riesgo. Ejemplo: tarifa regular 10 USD/CBM con 400 kg o más = 20 USD/CBM.`,
    recepcion_usd_por_paquete: RECEPTION_FEE_USD,
    seguro_porcentaje_fob: num(appConfig?.insurance_percentage) || null,
    tarifa_por_cbm_por_estado: porEstado,
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