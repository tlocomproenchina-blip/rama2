// Shared shipping quote logic used by chatWithSupportAI and respondSupportTicketAI.
// Extracted to avoid duplication across backend functions.

export const DOOR_TO_DOOR_THRESHOLD = 0.130;
export const PACKAGE_RECEIVED_FEE = 1;

export function normalize(str: string): string {
  return (str || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function findRelevantArticles(articles: any[], query: string, limit: number): any[] {
  const q = normalize(query || '');
  if (!q) return [];
  const tokens = q.split(/\s+/).filter(Boolean);
  return articles
    .map((a) => {
      const titleNorm = normalize(a.title || '');
      const contentNorm = normalize((a.content || '').replace(/[#*`>_~\-]/g, ' '));
      const tagsNorm = normalize((a.tags || []).join(' '));
      let score = 0;
      for (const tok of tokens) {
        if (titleNorm.includes(tok)) score += 5;
        if (tagsNorm.includes(tok)) score += 3;
        if (contentNorm.includes(tok)) score += 1;
      }
      return { article: a, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.article);
}

export function calculateShipping(params: any, cfg: any, pricing: any, states: any[]): any {
  const { largo, ancho, alto, estado, peso_kg, fob_value } = params;

  const l = Number(largo), a = Number(ancho), h = Number(alto);
  if (!Number.isFinite(l) || !Number.isFinite(a) || !Number.isFinite(h)) {
    return { error: 'Las dimensiones (largo, ancho, alto) son obligatorias en cm.' };
  }
  let volumetric_cbm = (l * a * h) / 1_000_000;
  if (volumetric_cbm <= 0) return { error: 'Las dimensiones deben ser mayores a 0.' };

  let billable_cbm = volumetric_cbm;
  let weight_applied = false;
  if (volumetric_cbm > 1) {
    if (typeof peso_kg !== 'number' || !Number.isFinite(peso_kg)) {
      return {
        need_weight: true,
        message: `El volumen de tu carga es ${volumetric_cbm.toFixed(3)} CBM, que supera 1 CBM. Para darte un cálculo preciso necesito el peso estimado en kg.`
      };
    }
    if (peso_kg >= 500) {
      const weight_cbm = peso_kg / 500;
      if (weight_cbm > volumetric_cbm) {
        billable_cbm = weight_cbm;
        weight_applied = true;
      }
    }
  }

  const base_rate_regular = Number(pricing.base_rate_regular ?? 690);
  const base_rate_high_risk = Number(pricing.base_rate_high_risk ?? 790);
  const profit_pct = Number(pricing.profit_percentage ?? 0);
  const door_to_door_cost = Number(pricing.door_to_door_cost ?? 20);
  const insurance_pct = Number(cfg.insurance_percentage ?? 5);
  const DEFAULT_SPECIAL_RATES = [
    { min_cbm: 0.0001, max_cbm: 0.0025, rate_regular: 3.6, rate_high_risk: 5.4 },
    { min_cbm: 0.0026, max_cbm: 0.007, rate_regular: 11.4, rate_high_risk: 17.4 },
    { min_cbm: 0.0071, max_cbm: 0.015, rate_regular: 24, rate_high_risk: 36 },
    { min_cbm: 0.016, max_cbm: 0.03, rate_regular: 48, rate_high_risk: 72 },
    { min_cbm: 0.031, max_cbm: 0.06, rate_regular: 72, rate_high_risk: 120 },
    { min_cbm: 0.061, max_cbm: 0.08, rate_regular: 96, rate_high_risk: 159.6 },
    { min_cbm: 0.09, max_cbm: 0.129, rate_regular: 102, rate_high_risk: 204 }
  ];
  const special_rates = (Array.isArray(cfg.special_cbm_rates) && cfg.special_cbm_rates.length > 0)
    ? cfg.special_cbm_rates
    : DEFAULT_SPECIAL_RATES;

  const fob = Number(fob_value);
  if (!Number.isFinite(fob) || fob < 0) {
    return { error: 'El valor FOB de la mercancía es obligatorio para calcular el seguro.' };
  }
  const insurance = (insurance_pct / 100) * fob;

  let freight_regular = 0, freight_high = 0;
  let rate_regular = 0, rate_high = 0;
  let service_type = '', service_notes = '';
  let state_name = estado || null;

  if (billable_cbm >= DOOR_TO_DOOR_THRESHOLD) {
    if (!estado) {
      return { error: 'Para cargas de 0.13 CBM o más necesito el estado de destino.' };
    }
    const stateNorm = normalize(estado);
    const state = states.find((s: any) =>
      normalize(s.state_name) === stateNorm ||
      normalize(s.state_code) === stateNorm ||
      normalize(s.state_name).includes(stateNorm) ||
      stateNorm.includes(normalize(s.state_name))
    );
    if (!state) {
      return { error: `No encontré el estado "${estado}" en nuestra lista de destinos disponibles.` };
    }
    state_name = state.state_name;

    rate_regular = state.final_rate_regular && state.final_rate_regular > 0
      ? Number(state.final_rate_regular)
      : (base_rate_regular * (1 + profit_pct / 100) + Number(state.shipping_rate || 0) + door_to_door_cost);
    rate_high = state.final_rate_high && state.final_rate_high > 0
      ? Number(state.final_rate_high)
      : (base_rate_high_risk * (1 + profit_pct / 100) + Number(state.shipping_rate || 0) + door_to_door_cost);

    freight_regular = billable_cbm * rate_regular;
    freight_high = billable_cbm * rate_high;
    service_type = 'puerta_a_puerta';
    service_notes = 'Incluye servicio puerta a puerta (entrega hasta tu dirección).';
  } else {
    const sorted = [...special_rates].sort((x, y) => Number(x.min_cbm) - Number(y.min_cbm));
    const found = sorted.find((r) => billable_cbm >= Number(r.min_cbm) && billable_cbm <= Number(r.max_cbm));
    if (!found) {
      return { error: 'No se encontró una tarifa especial para este volumen. Verifica las dimensiones.' };
    }
    rate_regular = Number(found.rate_regular);
    rate_high = Number(found.rate_high_risk);
    freight_regular = rate_regular;
    freight_high = rate_high;
    service_type = 'almacen_valencia_mrw';
    service_notes = 'Carga menor a 0.13 CBM. Aplica tarifa fija por rango. La entrega es puerta a puerta en la dirección del cliente.';
  }

  const reception_fee = PACKAGE_RECEIVED_FEE;
  const subtotal_regular = freight_regular + reception_fee;
  const total_regular = subtotal_regular + insurance;
  const subtotal_high = freight_high + reception_fee;
  const total_high = subtotal_high + insurance;

  return {
    dimensions: { largo: l, ancho: a, alto: h },
    volumetric_cbm: Number(volumetric_cbm.toFixed(6)),
    billable_cbm: Number(billable_cbm.toFixed(6)),
    weight_applied,
    peso_kg: typeof peso_kg === 'number' ? peso_kg : null,
    estado: state_name,
    fob_value: fob,
    service_type,
    service_notes,
    pricing: {
      rate_regular: Number(rate_regular.toFixed(2)),
      rate_high: Number(rate_high.toFixed(2)),
      reception_fee,
      insurance_percentage: insurance_pct
    },
    results: {
      general: {
        flete: Number(freight_regular.toFixed(2)),
        recepcion: Number(reception_fee.toFixed(2)),
        seguro: Number(insurance.toFixed(2)),
        total: Number(total_regular.toFixed(2))
      },
      alto_riesgo: {
        flete: Number(freight_high.toFixed(2)),
        recepcion: Number(reception_fee.toFixed(2)),
        seguro: Number(insurance.toFixed(2)),
        total: Number(total_high.toFixed(2))
      }
    }
  };
}

export const SHIPPING_TOOL = {
  type: 'function' as const,
  function: {
    name: 'calculate_shipping_quote',
    description: 'Calcula el costo de envío marítimo basado en dimensiones (cm), estado de destino y valor FOB. Devuelve precios para carga general y alto riesgo con desglose de flete, seguro y recepción.',
    parameters: {
      type: 'object',
      properties: {
        largo: { type: 'number', description: 'Largo del paquete en centímetros' },
        ancho: { type: 'number', description: 'Ancho del paquete en centímetros' },
        alto: { type: 'number', description: 'Alto del paquete en centímetros' },
        estado: { type: 'string', description: 'Nombre del estado de Venezuela de destino (ej: Carabobo, Zulia, Miranda, Aragua)' },
        peso_kg: { type: 'number', description: 'Peso estimado en kilogramos (solo necesario si el volumen supera 1 CBM)' },
        fob_value: { type: 'number', description: 'Valor FOB de la mercancía en USD (para calcular el seguro)' }
      },
      required: ['largo', 'ancho', 'alto', 'fob_value']
    }
  }
};