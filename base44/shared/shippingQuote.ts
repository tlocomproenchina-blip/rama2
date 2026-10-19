// Shared shipping quote logic used by chatWithSupportAI and respondSupportTicketAI.
// Extracted to avoid duplication across backend functions.
//
// Reglas (las mismas de la calculadora de envíos):
//   - No hay volumen mínimo ni máximo: toda la carga se cobra por su volumen real en CBM
//     con la tarifa por CBM del estado de destino.
//   - No existe tarifa fija por rango (el antiguo tratamiento de las cargas
//     menores a 0.130 CBM).
//   - Desde 400 kg inclusive la tarifa por CBM se cobra al doble, en carga
//     regular y en carga de alto riesgo / sensible. Hasta 399 kg se cobra normal.

export const PACKAGE_RECEIVED_FEE = 1;
// Desde este peso (inclusive) la tarifa por CBM se cobra al doble.
export const WEIGHT_DOUBLE_FROM_KG = 400;

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
  const volumetric_cbm = (l * a * h) / 1_000_000;
  if (volumetric_cbm <= 0) return { error: 'Las dimensiones deben ser mayores a 0.' };

  // El volumen real manda: sin volumen mínimo ni máximo ni tarifa fija por rango.
  const billable_cbm = volumetric_cbm;

  // Hasta 399 kg la tarifa es normal; desde 400 kg inclusive el envío va al doble.
  const weight_multiplier = (typeof peso_kg === 'number' && Number.isFinite(peso_kg) && peso_kg >= WEIGHT_DOUBLE_FROM_KG) ? 2 : 1;

  // En cargas de más de 1 CBM el peso decide si aplica el x2: hay que pedirlo.
  if (volumetric_cbm > 1 && (typeof peso_kg !== 'number' || !Number.isFinite(peso_kg))) {
    return {
      need_weight: true,
      message: `El volumen de tu carga es ${volumetric_cbm.toFixed(3)} CBM, que supera 1 CBM. Para darte un cálculo preciso necesito el peso estimado en kg.`
    };
  }

  if (!estado) {
    return { error: 'Necesito el estado de destino del cliente para calcular el envío marítimo.' };
  }

  const base_rate_regular = Number(pricing.base_rate_regular ?? 690);
  const base_rate_high_risk = Number(pricing.base_rate_high_risk ?? 790);
  const profit_pct = Number(pricing.profit_percentage ?? 0);
  const door_to_door_cost = Number(pricing.door_to_door_cost ?? 20);
  const insurance_pct = Number(cfg.insurance_percentage ?? 5);

  const fob = Number(fob_value);
  if (!Number.isFinite(fob) || fob < 0) {
    return { error: 'El valor FOB de la mercancía es obligatorio para calcular el seguro.' };
  }
  const insurance = (insurance_pct / 100) * fob;

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
  const state_name = state.state_name;

  const rate_regular = state.final_rate_regular && state.final_rate_regular > 0
    ? Number(state.final_rate_regular)
    : (base_rate_regular * (1 + profit_pct / 100) + Number(state.shipping_rate || 0) + door_to_door_cost);
  const rate_high = state.final_rate_high && state.final_rate_high > 0
    ? Number(state.final_rate_high)
    : (base_rate_high_risk * (1 + profit_pct / 100) + Number(state.shipping_rate || 0) + door_to_door_cost);

  const freight_regular = billable_cbm * rate_regular * weight_multiplier;
  const freight_high = billable_cbm * rate_high * weight_multiplier;

  const reception_fee = PACKAGE_RECEIVED_FEE;
  const subtotal_regular = freight_regular + reception_fee;
  const total_regular = subtotal_regular + insurance;
  const subtotal_high = freight_high + reception_fee;
  const total_high = subtotal_high + insurance;

  return {
    dimensions: { largo: l, ancho: a, alto: h },
    volumetric_cbm: Number(volumetric_cbm.toFixed(6)),
    billable_cbm: Number(billable_cbm.toFixed(6)),
    weight_multiplier,
    peso_kg: typeof peso_kg === 'number' ? peso_kg : null,
    estado: state_name,
    fob_value: fob,
    service_type: 'puerta_a_puerta',
    service_notes: weight_multiplier === 2
      ? 'Incluye servicio puerta a puerta (entrega hasta tu dirección). La carga pesa 400 kg o más: la tarifa por CBM se cobró al doble.'
      : 'Incluye servicio puerta a puerta (entrega hasta tu dirección).',
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
    description: 'Calcula el costo de envío marítimo con las dimensiones (cm), el estado de destino y el valor FOB; para cargas de más de 1 CBM también necesita el peso estimado. Devuelve precios para carga general y alto riesgo con desglose de flete, seguro y recepción. Toda la carga se cobra por su volumen real en CBM: no hay volumen mínimo ni máximo ni tarifa fija por rango. Desde 400 kg la tarifa por CBM se cobra al doble en ambos tipos de carga.',
    parameters: {
      type: 'object',
      properties: {
        largo: { type: 'number', description: 'Largo del paquete en centímetros' },
        ancho: { type: 'number', description: 'Ancho del paquete en centímetros' },
        alto: { type: 'number', description: 'Alto del paquete en centímetros' },
        estado: { type: 'string', description: 'Nombre del estado de Venezuela de destino (ej: Carabobo, Zulia, Miranda, Aragua)' },
        peso_kg: { type: 'number', description: 'Peso estimado en kilogramos (necesario cuando el volumen supera 1 CBM; desde 400 kg la tarifa por CBM se cobra al doble)' },
        fob_value: { type: 'number', description: 'Valor FOB de la mercancía en USD (para calcular el seguro)' }
      },
      required: ['largo', 'ancho', 'alto', 'estado', 'fob_value']
    }
  }
};