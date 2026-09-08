import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import OpenAI from 'npm:openai';
import { secrets } from 'base44:runtime';

const SYSTEM_PROMPT = `Eres el asistente de soporte de TLEC CARGO, un sistema de envíos marítimos entre China y Venezuela.

REGLAS CRÍTICAS DE SEGURIDAD Y PRIVACIDAD:
1. Solo puedes ver y mencionar información de la cuenta del cliente que está chateando contigo ahora mismo.
2. NUNCA compartas información sobre otros clientes, administradores, empleados o proveedores.
3. Si te preguntan sobre datos de otra persona, responde que no puedes compartir información de otras cuentas.
4. No inventes datos que no estén en el contexto proporcionado.
5. Si no tienes la información necesaria, sugiere crear un ticket de soporte.

INSTRUCCIONES:
- Responde en español, de forma natural, amigable y concisa
- Usa los datos de la cuenta del cliente para responder preguntas sobre sus paquetes, tracking, facturas y consolidaciones
- Usa los datos de los almacenes en China para responder preguntas sobre direcciones de envío
- Usa los artículos de la base de conocimiento para preguntas generales sobre procesos, tarifas, políticas
- Si el cliente necesita ayuda humana que no puedes dar, sugiere crear un ticket de soporte
- Formatea respuestas con markdown cuando sea útil (listas, negritas)
- Mantén las respuestas breves, máximo 3-4 párrafos

COTIZACIONES DE ENVÍO MARÍTIMO — REGLA OBLIGATORIA:
- TLEC CARGO NO ofrece envío aéreo. Solo marítimo. Si preguntan por aéreo, indícalo claramente.
- REGLA ABSOLUTA: Si el cliente menciona dimensiones (ej: "40x40x27", "caja de 30x30x30 cm") Y un valor FOB o valor de la mercancía, DEBES llamar a la herramienta calculate_shipping_quote INMEDIATAMENTE. No exceptions. No pidas confirmación. No repitas los datos. Llama la herramienta y formatea el resultado.
- Si el cliente da dimensiones pero NO da el estado de destino, pregúntale "¿A qué estado de Venezuela deseas enviar?" y espera su respuesta. NO llames la herramienta aún.
- Si el cliente da dimensiones pero NO da el valor FOB, pregúntale "¿Cuál es el valor FOB (valor) de tu mercancía en dólares?" y espera su respuesta. NO llames la herramienta aún.
- Si las dimensiones son grandes (más de 100 cm en cualquier lado, o el producto de los tres supera 1,000,000), pide el peso estimado: "¿Cuál es el peso estimado en kg?" antes de llamar la herramienta.
- NUNCA hagas cálculos matemáticos tú mismo. NUNCA inventes precios. SIEMPRE usa la herramienta calculate_shipping_quote.
- La herramienta te devolverá dos precios: carga general y alto riesgo. Muestra AMambos con desglose (flete, seguro, recepción, puerta a puerta si aplica).
- Si el resultado dice "almacen_valencia_mrw", menciona que llega al almacén de Valencia y el despacho final es vía MRW con cobro a destino.
- Si el resultado dice "puerta_a_puerta", menciona que incluye entrega hasta la puerta.
- La herramienta te devolverá dos precios: carga general y carga de alto riesgo. Muestra AMBOS en tu respuesta con un desglose claro (flete, seguro, recepción, puerta a puerta si aplica).
- Si el resultado indica que es carga menor a 0.13 CBM, menciona que llega al almacén de Valencia y el despacho final es vía MRW con cobro a destino.
- Si el resultado indica puerta a puerta, menciona que incluye entrega hasta la puerta.`;

function normalize(str: string): string {
  return (str || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function findRelevantArticles(articles: any[], query: string, limit: number): any[] {
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

// ===== Shipping quote calculation =====
const DOOR_TO_DOOR_THRESHOLD = 0.130;
const PACKAGE_RECEIVED_FEE = 1;

function calculateShipping(params: any, cfg: any, pricing: any, states: any[]): any {
  const { largo, ancho, alto, estado, peso_kg, fob_value } = params;

  // 1) Calculate volumetric CBM (cm → m³)
  const l = Number(largo), a = Number(ancho), h = Number(alto);
  if (!Number.isFinite(l) || !Number.isFinite(a) || !Number.isFinite(h)) {
    return { error: 'Las dimensiones (largo, ancho, alto) son obligatorias en cm.' };
  }
  let volumetric_cbm = (l * a * h) / 1_000_000;
  if (volumetric_cbm <= 0) return { error: 'Las dimensiones deben ser mayores a 0.' };

  // 2) Weight-based CBM adjustment (only if CBM > 1 and weight >= 500kg)
  let billable_cbm = volumetric_cbm;
  let weight_applied = false;
  if (volumetric_cbm > 1) {
    if (typeof peso_kg !== 'number' || !Number.isFinite(peso_kg)) {
      return {
        need_weight: true,
        message: `El volumen de tu carga es ${volumetric_cbm.toFixed(3)} CBM, que supera 1 CBM. Para darte un cálculo preciso necesito el peso estimado en kg. Pregúntale al cliente: "¿Cuál es el peso estimado de tu carga en kilogramos?"`
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

  // 3) Config values
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

  // 4) Insurance
  const fob = Number(fob_value);
  if (!Number.isFinite(fob) || fob < 0) {
    return { error: 'El valor FOB de la mercancía es obligatorio para calcular el seguro.' };
  }
  const insurance = (insurance_pct / 100) * fob;

  // 5) Calculate based on CBM threshold
  let freight_regular = 0, freight_high = 0;
  let rate_regular = 0, rate_high = 0;
  let service_type = '', service_notes = '';
  let state_name = estado || null;

  if (billable_cbm >= DOOR_TO_DOOR_THRESHOLD) {
    // State-based pricing — need the state
    if (!estado) {
      return { error: 'Para cargas de 0.13 CBM o más necesito el estado de destino. Pregúntale al cliente a qué estado de Venezuela desea enviar.' };
    }
    // Find state (match by name or code)
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

    // State rate: use final_rate if defined, otherwise compute
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
    // Special fixed rate by CBM range (small cargo < 0.13 CBM)
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
    service_notes = 'Carga menor a 0.13 CBM. Llega a nuestro almacén en Valencia. El despacho final es vía MRW con cobro a destino (costo de MRW no incluido).';
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

// OpenAI tool definition
const SHIPPING_TOOL = {
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

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { messages = [], query = '' } = body as { messages: any[]; query: string };

    // Fetch user's data + config + states + pricing in parallel
    const [packages, invoices, consolidations, kbArticles, appConfigs, pricingConfigs, states] = await Promise.all([
      base44.entities.Package.filter({ client_email: user.email }, '-created_date', 20).catch(() => []),
      base44.entities.Invoice.filter({ client_email: user.email }, '-created_date', 10).catch(() => []),
      base44.entities.Consolidation.filter({ client_email: user.email }, '-created_date', 5).catch(() => []),
      base44.entities.KnowledgeBase.filter({ status: 'published' }, '-updated_date', 50).catch(() => []),
      base44.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1).catch(() => []),
      base44.entities.PricingConfig.filter({ config_key: 'main' }, '-updated_date', 1).catch(() => []),
      base44.entities.StateConfig.filter({ is_active: true }, 'state_name').catch(() => [])
    ]);

    const cfg = (appConfigs || [])[0] || {};
    const pricing = (pricingConfigs || [])[0] || {};
    const activeStates = (states || []);

    const statusLabels: Record<string, string> = {
      pre_alerta: 'Pre-alerta', recibido: 'Recibido', rechazado: 'Rechazado',
      consolidado: 'Consolidado', en_transito: 'En tránsito',
      disponible: 'Disponible', despachado: 'Despachado', entregado: 'Entregado'
    };

    const invoiceStatusLabels: Record<string, string> = {
      pendiente: 'Pendiente', revision: 'Revisión', pagada: 'Pagada',
      vencida: 'Vencida', cancelada: 'Cancelada'
    };

    const almacenes = [];
    if (cfg.warehouse_name && cfg.warehouse_address) {
      almacenes.push({
        nombre: cfg.warehouse_name,
        direccion: cfg.warehouse_address,
        telefono: cfg.warehouse_phone || null,
        codigo_postal: cfg.warehouse_zipcode || null
      });
    }
    if (cfg.warehouse2_name && cfg.warehouse2_address) {
      almacenes.push({
        nombre: cfg.warehouse2_name,
        direccion: cfg.warehouse2_address,
        telefono: cfg.warehouse2_phone || null,
        codigo_postal: cfg.warehouse2_zipcode || null
      });
    }

    const tarifas = [];
    if (cfg.rate_air_general) tarifas.push({ tipo: 'Aéreo general', valor: `$${cfg.rate_air_general}/kg` });
    if (cfg.rate_air_sensitive) tarifas.push({ tipo: 'Aéreo sensible', valor: `$${cfg.rate_air_sensitive}/kg` });
    if (cfg.rate_sea_general) tarifas.push({ tipo: 'Marítimo general', valor: `$${cfg.rate_sea_general}/CBM` });
    if (cfg.rate_sea_sensitive) tarifas.push({ tipo: 'Marítimo sensible', valor: `$${cfg.rate_sea_sensitive}/CBM` });
    if (cfg.insurance_percentage) tarifas.push({ tipo: 'Seguro', valor: `${cfg.insurance_percentage}% del FOB` });

    const context = {
      cliente: {
        nombre: user.full_name,
        email: user.email,
        shipping_mark: user.shipping_mark || 'No asignado',
        ciudad: user.city
      },
      almacenes_china: almacenes,
      tarifas_vigentes: tarifas,
      estados_disponibles: activeStates.map((s: any) => s.state_name),
      paquetes: (packages || []).map((p: any) => ({
        tracking: p.tracking_number,
        estado: statusLabels[p.status] || p.status,
        descripcion: p.description ? p.description.slice(0, 80) : null,
        tipo: p.shipping_type,
        fecha_recepcion: p.received_date,
        almacen: p.warehouse_name
      })),
      facturas: (invoices || []).map((inv: any) => ({
        numero: inv.invoice_number,
        estado: invoiceStatusLabels[inv.status] || inv.status,
        total: inv.total,
        pagado: inv.paid_amount || 0,
        saldo: ((inv.total || 0) - (inv.paid_amount || 0))
      })),
      consolidaciones: (consolidations || []).map((c: any) => ({
        tracking: c.consolidation_tracking || c.tracking_number,
        estado: c.status,
        paquetes: c.package_count || (c.items?.length || 0)
      })),
      base_conocimiento: (kbArticles || []).map((a: any) => ({
        titulo: a.title,
        categoria: a.category,
        contenido: a.content ? a.content.slice(0, 400) : ''
      }))
    };

    // Build messages for OpenAI
    const openaiMessages: any[] = [
      { role: 'system', content: SYSTEM_PROMPT + '\n\nDATOS DE LA CUENTA DEL CLIENTE Y CONTEXTO:\n' + JSON.stringify(context) }
    ];

    // Add conversation history (last 10 messages)
    const recentMessages = (messages || []).slice(-10);
    for (const msg of recentMessages) {
      if (msg.role === 'client') {
        openaiMessages.push({ role: 'user', content: msg.content });
      } else if (msg.role === 'assistant' && !msg.isWelcome && !msg.isFallback) {
        openaiMessages.push({ role: 'assistant', content: msg.content });
      }
    }

    // Add current query if not already in history
    if (query && !recentMessages.some((m) => m.role === 'client' && m.content === query)) {
      openaiMessages.push({ role: 'user', content: query });
    }

    const openai = new OpenAI({ apiKey: secrets.get('OPENAI_API_KEY') });

    // Detect if the current query looks like a shipping quote request
    const currentQuery = (query || '').toLowerCase();
    const hasDimensions = /\d+\s*[x×]\s*\d+\s*[x×]\s*\d+/.test(currentQuery) || /\d+\s*(cm|centimetros)/.test(currentQuery);
    const hasQuoteKeywords = /(cuanto|cuesta|cotiz|precio|costo|envio|envío|calcular|tarifa)/.test(currentQuery);
    const hasFob = /(fob|valor|dolar|dólar|\$|usd)/.test(currentQuery);
    // Estimate CBM from dimensions in the query to detect large cargo needing weight
    const dimMatch = currentQuery.match(/(\d+)\s*[x×]\s*(\d+)\s*[x×]\s*(\d+)/);
    const estimatedCbm = dimMatch ? (Number(dimMatch[1]) * Number(dimMatch[2]) * Number(dimMatch[3])) / 1_000_000 : 0;
    const needsWeight = estimatedCbm > 1;
    const forceTool = hasDimensions && hasQuoteKeywords && hasFob && !needsWeight;

    // Multi-turn function calling loop (max 3 tool calls)
    let aiResponse = '';
    let lastResponse: any = null;
    for (let turn = 0; turn < 3; turn++) {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: openaiMessages,
        max_tokens: 800,
        temperature: 0.5,
        tools: [SHIPPING_TOOL],
        tool_choice: (forceTool && turn === 0) ? 'required' : 'auto'
      });

      const choice = response.choices[0];
      const msg = choice.message;

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        // Add assistant message with tool calls
        openaiMessages.push(msg);
        // Execute each tool call
        for (const tc of msg.tool_calls) {
          if (tc.function.name === 'calculate_shipping_quote') {
            const params = JSON.parse(tc.function.arguments || '{}');
            const result = calculateShipping(params, cfg, pricing, activeStates);
            openaiMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: JSON.stringify(result)
            });
          }
        }
        continue; // Let OpenAI process the tool result
      }

      // No tool calls — this is the final response
      aiResponse = msg.content || '';
      lastResponse = response;
      break;
    }

    if (!aiResponse && lastResponse) {
      aiResponse = lastResponse.choices[0].message.content || '';
    }

    const suggestedArticles = findRelevantArticles(kbArticles || [], query, 3);

    return Response.json({
      response: aiResponse,
      suggested_articles: suggestedArticles
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}