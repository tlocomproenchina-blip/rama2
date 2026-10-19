import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import OpenAI from 'npm:openai';
import { secrets } from 'base44:runtime';
import { calculateShipping, SHIPPING_TOOL, normalize, findRelevantArticles } from '../../shared/shippingQuote.ts';

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
- Cuando el cliente mencione dimensiones (ej: "40x40x27", "caja de 30x30x30 cm"), calcula mentalmente el volumen: (largo × ancho × alto) / 1,000,000 = CBM.
- REGLA DE DATOS FALTANTES (pide todo lo que falte en UN SOLO mensaje):
  * El valor FOB (valor de la mercancía en dólares) es OBLIGATORIO siempre. Si no lo da, pídelo.
  * El estado de destino es OBLIGATORIO siempre, sin importar lo pequeña que sea la carga: el envío se cobra por CBM con la tarifa de ese estado.
  * No hay volumen mínimo ni máximo ni tarifa fija por rango: se cobra el volumen real de la carga.
  * Si el CBM estimado supera 1 (más de 1,000,000 cm³): pide también el peso estimado en kg.
- REGLA ABSOLUTA: Si el cliente da dimensiones Y todos los datos requeridos (FOB y estado siempre; peso si CBM > 1), DEBES llamar a la herramienta calculate_shipping_quote INMEDIATAMENTE. No pidas confirmación. No repitas los datos. Llama la herramienta y formatea el resultado.
- NUNCA hagas cálculos matemáticos tú mismo. NUNCA inventes precios. SIEMPRE usa la herramienta calculate_shipping_quote.
- La herramienta te devolverá dos precios: carga general y carga de alto riesgo. Muestra AMBOS en tu respuesta con un desglose claro (flete, seguro, recepción).
- Si el resultado trae weight_multiplier 2, aclara que la carga pesa 400 kg o más y por eso la tarifa por CBM se cobró al doble. Hasta 399 kg se cobra la tarifa normal.
- La entrega es puerta a puerta en la dirección del cliente: nunca menciones MRW ni Zoom, ni retiro en oficinas de encomiendas, ni un precio por bulto.

MÚLTIPLES BULTOS EN UN EMBARQUE:
- Si el cliente describe más de un bulto (ej: "Artículo 1", "Artículo 2", múltiples sets de dimensiones como "53*39*20" y "57*29*28"), cotiza CADA bulto por separado llamando la herramienta calculate_shipping_quote una vez por bulto.
- Presenta cada cotización con su desglose (flete, seguro, recepción) y al final muestra un total combinado sumando todos los bultos.

DETECCIÓN DE ALTO RIESGO:
- Aplica la tarifa de alto riesgo automáticamente si el cliente menciona cualquiera de estas palabras clave: batería, litio, LiFePO4, ión-litio, líquido, polvo, imán, magnético, perfume, cosmético, electrónico con batería, replica, marca, f牌, 带电, 液体, 粉末.
- Si la mercancía es ambigua (ej: "un equipo", "artículo") y no puedes determinar si es general o alto riesgo, PREGUNTA al cliente antes de cotizar, en el mismo mensaje donde pides otros datos faltantes.

TIEMPOS DE TRÁNSITO Y CONTINGENCIA ADUANERA:
- Si el cliente pregunta por tiempos de tránsito o estado de su envío, usa los artículos de la base de conocimiento con tag "tiempo-transito" (campo articulos_transito del contexto) para responder con la información actual.
- En TODA respuesta que involucre cotizaciones, tiempos de tránsito o estado de envío, incluye OBLIGATORIAMENTE el mensaje de contingencia aduanera del artículo con tag "contingencia-aduanas" (campo articulos_contingencia del contexto). Preséntalo de forma empática y natural, no como un disclaimer robótico. Ejemplo: "Ten en cuenta que las aduanas en Venezuela están en contingencia nacional tras el terremoto, por lo que el tiempo de tránsito podría extenderse más de lo habitual. Agradecemos tu paciencia."
- NO copies el texto literal del artículo. Adáptalo a un tono cálido y conversacional.

CONCIENCIA CONVERSACIONAL — MUY IMPORTANTE:
- Si ya pediste un dato (FOB, estado, peso) y el cliente repite su pregunta sin proporcionar lo que pediste, NO repitas la misma respuesta palabra por palabra.
- Reconoce la situación: "Veo que sigues necesitando la cotización. Para darte el precio exacto necesito que me digas: [lo que falte]."
- Sé específico y claro sobre qué dato falta y por qué lo necesitas, de forma distinta cada vez.
- NUNCA des una respuesta idéntica a una anterior en la misma conversación.`;

// normalize, findRelevantArticles, calculateShipping, SHIPPING_TOOL imported from shared module

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
      })),
      articulos_transito: (kbArticles || [])
        .filter((a: any) => (a.tags || []).some((t: string) => /transito|tiempo-transito/i.test(t)))
        .map((a: any) => ({ titulo: a.title, contenido: a.content || '' })),
      articulos_contingencia: (kbArticles || [])
        .filter((a: any) => (a.tags || []).some((t: string) => /contingencia|aduanas/i.test(t)))
        .map((a: any) => ({ titulo: a.title, contenido: a.content || '' }))
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

    // Detect shipping quote data across the full conversation (dimensions may be in an earlier message)
    const allClientText = [
      ...(messages || []).filter((m: any) => m.role === 'client').map((m: any) => m.content || ''),
      query || ''
    ].join(' ').toLowerCase();
    const hasDimensions = /\d+\s*[x×*]\s*\d+\s*[x×*]\s*\d+/.test(allClientText) || /\d+\s*(cm|centimetros)/.test(allClientText);
    const hasQuoteKeywords = /(cuanto|cuesta|cotiz|precio|costo|envio|envío|calcular|tarifa)/.test(allClientText);
    const hasFob = /(fob|valor|dolar|dólar|\$|usd)/.test(allClientText);
    // Estimate CBM from dimensions in the combined text to detect large cargo needing weight
    const dimMatch = allClientText.match(/(\d+)\s*[x×*]\s*(\d+)\s*[x×*]\s*(\d+)/);
    const estimatedCbm = dimMatch ? (Number(dimMatch[1]) * Number(dimMatch[2]) * Number(dimMatch[3])) / 1_000_000 : 0;
    const needsWeight = estimatedCbm > 1;
    const forceTool = hasDimensions && hasQuoteKeywords && hasFob && !needsWeight;

    // Multi-turn function calling loop (max 3 tool calls)
    let aiResponse = '';
    let lastResponse: any = null;
    for (let turn = 0; turn < 6; turn++) {
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

    const suggestedArticles = (hasDimensions && hasQuoteKeywords) ? [] : findRelevantArticles(kbArticles || [], query, 3);

    return Response.json({
      response: aiResponse,
      suggested_articles: suggestedArticles
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}