import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import OpenAI from 'npm:openai';
import { secrets } from 'base44:runtime';
import { calculateShipping, SHIPPING_TOOL, normalize, findRelevantArticles } from '../../shared/shippingQuote.ts';

const TICKET_SYSTEM_PROMPT = `Eres el asistente de soporte de TLEC CARGO, un sistema de envíos marítimos entre China y Venezuela. Estás respondiendo un ticket de soporte de un cliente real.

REGLAS CRÍTICAS DE SEGURIDAD Y PRIVACIDAD:
1. Solo puedes ver y mencionar información de la cuenta del cliente que abrió este ticket.
2. NUNCA compartas información sobre otros clientes, administradores, empleados o proveedores.
3. Si te preguntan sobre datos de otra persona, responde que no puedes compartir información de otras cuentas.
4. No inventes datos que no estén en el contexto proporcionado.
5. Si no tienes la información necesaria, pídelo amablemente al cliente.

TONO Y HUMANIZACIÓN — MUY IMPORTANTE:
- Lee TODO el historial del ticket antes de responder para entender el contexto completo de la conversación y el estado emocional del cliente.
- Sé cálido, amable, gentil y empático. Trata al cliente como una persona real, no como un número.
- NO uses un tono robótico, frío, ni burocrático. NO suenes como un administrador del sistema a menos que el cliente lo pida explícitamente.
- Usa un trato cercano: "Hola", "Claro que sí", "Por supuesto", "Entiendo tu preocupación", "Estoy aquí para ayudarte".
- Reconoce la emoción del cliente si expresa frustración o preocupación antes de dar la respuesta técnica.
- Responde en español, de forma natural y conversacional.
- Mantén las respuestas concisas pero completas (máximo 3-4 párrafos).
- Formatea con markdown cuando sea útil (listas, negritas) pero sin exagerar.

RESPUESTA SOBRE RECIBOS Y ESTADO DE TRÁNSITO:
- Si el cliente pregunta por el estado de un recibo o envío, revisa los recibos (campo "recibos") del cliente.
- Cada recibo tiene un campo "estado_transito":
  * "en_transito": la carga ya tiene fecha de salida. Informa la fecha de salida y la fecha estimada de llegada.
  * "esperando_bl": el recibo fue creado pero NO tiene fecha de salida todavía. Indica que están esperando el BL (Bill of Lading) para cargar la fecha de salida. NO prometas fechas estimadas si no están en el contexto.
- Si el cliente pregunta por un recibo específico que no aparece en su lista, indícale que no tienes registro de ese recibo a su nombre y pídele el número de factura o tracking para buscarlo.

RESPUESTA SOBRE PAQUETES, FACTURAS, PRE-ALERTAS Y ÓRDENES DE DESPACHO:
- Usa los datos del cliente para responder con precisión sobre sus paquetes (tracking, estado, descripción), facturas (número, estado, total, saldo), pre-alertas y órdenes de despacho.
- NUNCA inventes números de tracking, facturas o fechas que no estén en el contexto.

COTIZACIONES DE ENVÍO MARÍTIMO:
- TLEC CARGO NO ofrece envío aéreo. Solo marítimo.
- Si el cliente da dimensiones (ej: "40x40x27") Y el valor FOB Y (si CBM >= 0.13) el estado de destino, usa la herramienta calculate_shipping_quote INMEDIATAMENTE.
- Si faltan datos (FOB, estado, o peso si CBM > 1), pídelos en un solo mensaje de forma amable.
- NUNCA hagas cálculos matemáticos tú mismo. SIEMPRE usa la herramienta.
- Muestra ambos precios (general y alto riesgo) con desglose claro.

DECISIÓN DE RESPUESTA:
- Si puedes responder con los datos disponibles: responde amablemente.
- Si faltan datos del cliente (tracking, factura, detalles del problema): pídelos amablemente (action: "ask_info").
- Si el tema está fuera de tu alcance (disputas de pago, quejas formales, solicitudes que requieren acción humana, reembolsos): indica con empatía que vas a escalar el ticket a un agente humano para que te ayude (action: "escalate").

FORMATO DE RESPUESTA OBLIGATORIO:
Debes responder SIEMPRE como un JSON válido con esta estructura:
{
  "action": "answer" | "ask_info" | "escalate",
  "message": "tu respuesta al cliente"
}
- "answer": puedes responder completamente con los datos disponibles.
- "ask_info": necesitas más información del cliente (explica qué necesitas en "message").
- "escalate": el tema requiere atención humana (explica en "message" que lo estás escalando).`;

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { ticket_id } = body as { ticket_id: string };

    if (!ticket_id) {
      return Response.json({ error: 'ticket_id es obligatorio' }, { status: 400 });
    }

    // Auth check: if a user session exists, require admin (allows admin testing from UI).
    // Workflow invocations have no user session — proceed with service role.
    let hasAdminSession = false;
    try {
      const user = await base44.auth.me();
      if (user) {
        if (user.role !== 'admin') {
          return Response.json({ error: 'Forbidden' }, { status: 403 });
        }
        hasAdminSession = true;
      }
    } catch {
      // No session (workflow invocation) — proceed.
    }

    // Load config to check if AI autoresponder is enabled
    const appConfigs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1).catch(() => []);
    const cfg = (appConfigs || [])[0] || {};
    if (!cfg.ai_ticket_autoresponder_enabled) {
      return Response.json({ skipped: true, reason: 'AI autoresponder disabled' });
    }
    const responseMode = cfg.ai_ticket_response_mode === 'review' ? 'review' : 'direct';

    // Load the ticket
    const ticket = await base44.asServiceRole.entities.SupportTicket.get(ticket_id).catch(() => null);
    if (!ticket) {
      return Response.json({ error: 'Ticket no encontrado' }, { status: 404 });
    }

    // Skip if ticket is closed or resolved
    if (ticket.status === 'cerrado' || ticket.status === 'resuelto') {
      return Response.json({ skipped: true, reason: 'Ticket cerrado/resuelto' });
    }

    // Skip if already escalated
    if (ticket.ai_escalated) {
      return Response.json({ skipped: true, reason: 'Ticket escalado a humano' });
    }

    const messages = ticket.messages || [];
    if (messages.length === 0) {
      return Response.json({ skipped: true, reason: 'Sin mensajes' });
    }

    // Only respond if the last message is from a client (not admin, not AI)
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.is_admin || lastMsg.is_ai) {
      return Response.json({ skipped: true, reason: 'Último mensaje no es del cliente' });
    }

    const clientEmail = ticket.client_email;

    // Load client data in parallel
    const [clients, packages, cbmIngresos, invoices, dispatchOrders, consolidations, kbArticles, pricingConfigs, states] = await Promise.all([
      base44.asServiceRole.entities.User.filter({ email: clientEmail }, '-created_date', 1).catch(() => []),
      base44.asServiceRole.entities.Package.filter({ client_email: clientEmail }, '-created_date', 30).catch(() => []),
      base44.asServiceRole.entities.CbmIngreso.filter({ client_email: clientEmail }, '-created_date', 20).catch(() => []),
      base44.asServiceRole.entities.Invoice.filter({ client_email: clientEmail }, '-created_date', 10).catch(() => []),
      base44.asServiceRole.entities.DispatchOrder.filter({ client_email: clientEmail }, '-created_date', 10).catch(() => []),
      base44.asServiceRole.entities.Consolidation.filter({ client_email: clientEmail }, '-created_date', 5).catch(() => []),
      base44.asServiceRole.entities.KnowledgeBase.filter({ status: 'published' }, '-updated_date', 50).catch(() => []),
      base44.asServiceRole.entities.PricingConfig.filter({ config_key: 'main' }, '-updated_date', 1).catch(() => []),
      base44.asServiceRole.entities.StateConfig.filter({ is_active: true }, 'state_name').catch(() => [])
    ]);

    const client = (clients || [])[0] || {};
    const pricing = (pricingConfigs || [])[0] || {};
    const activeStates = (states || []);

    const statusLabels: Record<string, string> = {
      pre_alerta: 'Pre-alerta', recibido: 'Recibido', rechazado: 'Rechazado',
      consolidado: 'Consolidado', en_transito: 'En tránsito',
      disponible: 'Disponible', despachado: 'Despachado', entregado: 'Entregado',
      sin_cliente: 'Sin cliente'
    };

    const invoiceStatusLabels: Record<string, string> = {
      pendiente: 'Pendiente', revision: 'Revisión', pagada: 'Pagada',
      vencida: 'Vencida', cancelada: 'Cancelada'
    };

    const dispatchStatusLabels: Record<string, string> = {
      emitida: 'Emitida', despachado: 'Despachado', cancelada: 'Cancelada'
    };

    // Pre-calculate transit state for each CbmIngreso
    const recibos = (cbmIngresos || []).map((r: any) => {
      const tieneFechaSalida = !!r.fecha_salida;
      return {
        factura: r.invoice_number || 'Sin factura',
        cbm: r.cbm,
        fecha_registro: r.fecha,
        fecha_salida: r.fecha_salida || null,
        fecha_estimada_llegada: r.fecha_estimada_llegada || null,
        disponible_entrega: r.disponible_entrega || false,
        trackings: r.tracking_numbers || [],
        estado_transito: tieneFechaSalida ? 'en_transito' : 'esperando_bl'
      };
    });

    const context = {
      ticket: {
        numero: ticket.ticket_number,
        asunto: ticket.subject,
        categoria: ticket.category,
        prioridad: ticket.priority,
        tracking_relacionado: ticket.related_tracking || null
      },
      cliente: {
        nombre: client.full_name || clientEmail,
        email: clientEmail,
        shipping_mark: client.shipping_mark || 'No asignado',
        ciudad: client.city || null,
        whatsapp: client.whatsapp || null
      },
      paquetes: (packages || []).map((p: any) => ({
        tracking: p.tracking_number,
        estado: statusLabels[p.status] || p.status,
        descripcion: p.description ? p.description.slice(0, 100) : null,
        tipo: p.shipping_type,
        fecha_recepcion: p.received_date,
        almacen: p.warehouse_name,
        riesgo: p.risk_category
      })),
      pre_alertas: (packages || []).filter((p: any) => p.status === 'pre_alerta').map((p: any) => ({
        tracking: p.tracking_number,
        descripcion: p.description ? p.description.slice(0, 100) : null
      })),
      recibos,
      facturas: (invoices || []).map((inv: any) => ({
        numero: inv.invoice_number,
        estado: invoiceStatusLabels[inv.status] || inv.status,
        total: inv.total,
        pagado: inv.paid_amount || 0,
        saldo: ((inv.total || 0) - (inv.paid_amount || 0)),
        fecha: inv.invoice_date,
        consolidacion_tracking: inv.consolidation_tracking || null
      })),
      ordenes_despacho: (dispatchOrders || []).map((d: any) => ({
        numero: d.order_number,
        estado: dispatchStatusLabels[d.status] || d.status,
        fecha_despacho: d.dispatched_date || null,
        paquetes: (d.items || []).length
      })),
      consolidaciones: (consolidations || []).map((c: any) => ({
        tracking: c.consolidation_tracking || c.tracking_number,
        estado: c.status,
        paquetes: c.package_count || (c.items?.length || 0)
      })),
      base_conocimiento: (kbArticles || []).map((a: any) => ({
        titulo: a.title,
        categoria: a.category,
        contenido: a.content ? a.content.slice(0, 300) : ''
      })),
      estados_disponibles: activeStates.map((s: any) => s.state_name)
    };

    // Build conversation history for OpenAI (all messages from the ticket)
    const conversationMessages: any[] = [
      { role: 'system', content: TICKET_SYSTEM_PROMPT + '\n\nDATOS DE LA CUENTA DEL CLIENTE Y CONTEXTO:\n' + JSON.stringify(context) }
    ];

    for (const msg of messages) {
      if (msg.is_admin) {
        conversationMessages.push({ role: 'assistant', content: msg.message });
      } else if (msg.is_ai) {
        conversationMessages.push({ role: 'assistant', content: msg.message });
      } else {
        conversationMessages.push({ role: 'user', content: msg.message });
      }
    }

    const openai = new OpenAI({ apiKey: secrets.get('OPENAI_API_KEY') });

    // Detect shipping quote request across the conversation
    const allClientText = messages
      .filter((m: any) => !m.is_admin && !m.is_ai)
      .map((m: any) => m.message || '')
      .join(' ')
      .toLowerCase();
    const hasDimensions = /\d+\s*[x×*]\s*\d+\s*[x×*]\s*\d+/.test(allClientText);
    const hasQuoteKeywords = /(cuanto|cuesta|cotiz|precio|costo|envio|envío|calcular|tarifa)/.test(allClientText);
    const hasFob = /(fob|valor|dolar|dólar|\$|usd)/.test(allClientText);
    const dimMatch = allClientText.match(/(\d+)\s*[x×*]\s*(\d+)\s*[x×*]\s*(\d+)/);
    const estimatedCbm = dimMatch ? (Number(dimMatch[1]) * Number(dimMatch[2]) * Number(dimMatch[3])) / 1_000_000 : 0;
    const needsWeight = estimatedCbm > 1;
    const forceTool = hasDimensions && hasQuoteKeywords && hasFob && !needsWeight;

    // Multi-turn function calling loop
    let aiResponse = '';
    let rawContent = '';
    for (let turn = 0; turn < 3; turn++) {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: conversationMessages,
        max_tokens: 1000,
        temperature: 0.6,
        tools: [SHIPPING_TOOL],
        tool_choice: (forceTool && turn === 0) ? 'required' : 'auto',
        response_format: { type: 'json_object' }
      });

      const choice = response.choices[0];
      const msg = choice.message;

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        conversationMessages.push(msg);
        for (const tc of msg.tool_calls) {
          if (tc.function.name === 'calculate_shipping_quote') {
            const params = JSON.parse(tc.function.arguments || '{}');
            const result = calculateShipping(params, cfg, pricing, activeStates);
            conversationMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: JSON.stringify(result)
            });
          }
        }
        continue;
      }

      rawContent = msg.content || '';
      break;
    }

    // Parse JSON response
    let action = 'answer';
    let aiMessage = rawContent;
    try {
      const parsed = JSON.parse(rawContent);
      action = parsed.action || 'answer';
      aiMessage = parsed.message || rawContent;
    } catch {
      // If not valid JSON, treat the whole content as the answer
      aiMessage = rawContent;
    }

    if (!aiMessage) {
      return Response.json({ skipped: true, reason: 'Respuesta vacía de la IA' });
    }

    const now = new Date().toISOString();

    if (action === 'escalate') {
      // Mark ticket as escalated, don't post AI message
      await base44.asServiceRole.entities.SupportTicket.update(ticket_id, {
        ai_escalated: true
      });
      // Notify admins
      try {
        const adminList = await base44.asServiceRole.functions.invoke('listAdmins', {}).catch(() => ({ data: { admins: [] } }));
        const admins = adminList?.data?.admins || [];
        for (const admin of admins) {
          await base44.asServiceRole.entities.Notification.create({
            user_email: admin.email,
            title: '🤖 Ticket escalado por IA',
            message: `El ticket ${ticket.ticket_number} de ${clientEmail} fue escalado para atención humana.`,
            type: 'general',
            icon: 'alert',
            reference_id: ticket_id
          }).catch(() => {});
        }
      } catch {}
      return Response.json({ action: 'escalate', message: aiMessage, escalated: true });
    }

    if (responseMode === 'review') {
      // Save as draft for admin review
      await base44.asServiceRole.entities.SupportTicket.update(ticket_id, {
        ai_pending_draft: aiMessage,
        ai_draft_date: now
      });
      return Response.json({ action, message: aiMessage, mode: 'review', draft_saved: true });
    }

    // Direct mode: post the AI message to the ticket
    const aiMsg = {
      sender_email: 'ai-assistant@tlec-cargo.local',
      sender_name: 'Asistente IA',
      message: aiMessage,
      timestamp: now,
      is_admin: false,
      is_ai: true,
      attachments: []
    };

    const updatedMessages = [...messages, aiMsg];
    await base44.asServiceRole.entities.SupportTicket.update(ticket_id, {
      messages: updatedMessages,
      status: ticket.status === 'abierto' ? 'en_proceso' : ticket.status
    });

    // Notify the client
    await base44.asServiceRole.entities.Notification.create({
      user_email: clientEmail,
      title: '💬 Nueva respuesta',
      message: `Tienes una nueva respuesta en ${ticket.ticket_number}`,
      type: 'general',
      icon: 'alert',
      reference_id: ticket_id
    }).catch(() => {});

    const suggestedArticles = (!hasDimensions || !hasQuoteKeywords) ? findRelevantArticles(kbArticles || [], allClientText, 3) : [];

    return Response.json({
      action,
      message: aiMessage,
      mode: 'direct',
      posted: true,
      suggested_articles: suggestedArticles
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}