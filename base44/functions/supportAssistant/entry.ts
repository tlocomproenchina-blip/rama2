import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { buildSupportClientContext } from '../../shared/supportClientContext.ts';

// Asistente de soporte para el ATC (área de Soporte).
// Acciones:
//   context  -> perfil e historial completo del cliente elegido
//   ask      -> guía paso a paso + respuesta sugerida para copiar por WhatsApp
//   escalate -> crea el ticket, asigna al supervisor y lo notifica

const ACTION_LABELS: Record<string, string> = {
  context: 'el contexto del cliente',
  ask: 'la guía de respuesta',
  escalate: 'el escalamiento del caso',
};

const SYSTEM_PROMPT = `Eres el copiloto de soporte de TLEC CARGO, una empresa de carga marítima de China a Venezuela.

Trabajas PARA el agente de atención al cliente (ATC). No hablas con el cliente: escribes para que el ATC sepa qué hacer y qué responderle.

Tu trabajo: leer la pregunta que el cliente envió por WhatsApp, cruzarla con el historial real del cliente que recibes en el contexto y guiar al ATC paso a paso hasta resolver el caso.

CÓMO GUIAR:
1. "diagnostico": qué está pasando según los datos reales del cliente (estado de sus paquetes, recibos, facturas, tickets, notas). Menciona los datos concretos que lo sustentan.
2. "paso_a_seguir": la acción puntual que el ATC debe hacer o verificar AHORA (una sola, la más útil). Si el ATC ya aplicó el paso anterior, propone el siguiente.
3. "respuesta_sugerida": el mensaje listo para copiar y enviar por WhatsApp, en español venezolano, cálido y profesional, máximo 4 frases, sin markdown, sin listas, sin firma.
4. "datos_clave": hasta 4 datos concretos del contexto que respaldan la orientación (tracking, estado, monto, fecha).
5. Avanza la conversación: no repitas una respuesta que ya se usó antes en el historial.

REGLAS ESTRICTAS:
- Usa SOLO la información del contexto y de las preguntas frecuentes / base de conocimiento. Si un dato no está, dilo y explica al ATC cómo verificarlo.
- NUNCA inventes trackings, montos, fechas ni estados. Nunca prometas fechas de entrega ni exenciones de cobro que no estén en los datos.
- Nada de información de otros clientes.

CUÁNDO ESCALAR (escalar = true, y explica el motivo en "motivo_escalamiento"):
- El cliente pide hablar con un supervisor o hacer un reclamo.
- Pérdida, daño, cobro indebido, diferencia de monto o compensación.
- El caso lleva dos o más vueltas sin resolverse o el cliente está molesto.
- Se necesita una excepción de política, un ajuste manual o información de otra área (almacén, contabilidad, logística).
- Falta un dato clave que el ATC no puede obtener (por ejemplo, la foto de recepción o el CBM oficial).
Si el caso es una consulta normal que el ATC puede resolver con el historial, escalar = false.

Siempre completa "asunto" con un título corto del caso para el ticket, y elige "categoria" y "prioridad".
Responde siempre en el JSON pedido y todo el texto en español.`;

const ANSWER_SCHEMA = {
  type: 'object',
  properties: {
    diagnostico: { type: 'string' },
    paso_a_seguir: { type: 'string' },
    respuesta_sugerida: { type: 'string' },
    datos_clave: { type: 'array', items: { type: 'string' } },
    escalar: { type: 'boolean' },
    motivo_escalamiento: { type: 'string' },
    asunto: { type: 'string' },
    categoria: { type: 'string', enum: ['pago', 'envio', 'tracking', 'consolidacion', 'actualizar_datos', 'otro'] },
    prioridad: { type: 'string', enum: ['baja', 'media', 'alta', 'urgente'] },
  },
  required: ['diagnostico', 'paso_a_seguir', 'respuesta_sugerida', 'escalar', 'asunto', 'categoria', 'prioridad'],
};

function short(text: any, max = 700) {
  if (!text) return '';
  const value = String(text).replace(/\s+/g, ' ').trim();
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function formatHistory(history: any) {
  if (!Array.isArray(history) || history.length === 0) return 'Todavía no hay intercambio previo.';
  return history
    .slice(-12)
    .map((turn: any) => {
      const who = turn?.role === 'cliente' ? 'CLIENTE' : turn?.role === 'atc' ? 'ATC' : 'ASISTENTE (ya sugerido)';
      return `${who}: ${short(turn?.text, 600)}`;
    })
    .join('\n');
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const role = String(user.custom_role || '').toLowerCase();
    const allowed = user.role === 'admin' || role === 'customer_service';
    if (!allowed) return Response.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '').trim();
    if (!ACTION_LABELS[action]) {
      return Response.json({ error: 'Acción no válida' }, { status: 400 });
    }

    const clientEmail = String(body.client_email || '').trim();
    if (!clientEmail) return Response.json({ error: 'Falta el cliente' }, { status: 400 });

    const context = await buildSupportClientContext(base44, clientEmail);
    if (!context) return Response.json({ error: 'No se encontró el cliente o su historial' }, { status: 404 });

    if (action === 'context') {
      return Response.json({ ok: true, context });
    }

    if (action === 'ask') {
      const question = short(body.question, 2000);
      if (!question) return Response.json({ error: 'Falta la pregunta del cliente' }, { status: 400 });

      const [faqsRes, kbRes] = await Promise.allSettled([
        base44.asServiceRole.entities.FAQ.filter({ is_active: true }, 'order', 30),
        base44.asServiceRole.entities.KnowledgeBase.filter({ status: 'published' }, '-updated_date', 20),
      ]);
      const faqs = faqsRes.status === 'fulfilled' && Array.isArray(faqsRes.value) ? faqsRes.value : [];
      const kb = kbRes.status === 'fulfilled' && Array.isArray(kbRes.value) ? kbRes.value : [];

      const faqText = faqs.length
        ? faqs.map((f: any) => `- ${short(f.question, 200)} → ${short(f.answer, 500)}`).join('\n')
        : 'Sin preguntas frecuentes publicadas.';
      const kbText = kb.length
        ? kb.map((a: any) => `- ${short(a.title, 120)}: ${short(a.content, 500)}`).join('\n')
        : 'Sin artículos en la base de conocimiento.';

      const prompt = `${SYSTEM_PROMPT}

HISTORIAL DISPONIBLE DEL CLIENTE (fuente de verdad):
${JSON.stringify(context, null, 1)}

PREGUNTAS FRECUENTES Y POLÍTICAS DE LA EMPRESA:
${faqText}

BASE DE CONOCIMIENTO:
${kbText}

CONVERSACIÓN HASTA AHORA (la última línea del ATC indica en qué punto va el caso):
${formatHistory(body.history)}

MENSAJE QUE EL CLIENTE ACABA DE ENVIAR POR WHATSAPP:
"${question}"

Devuelve el diagnóstico, el siguiente paso para el ATC, la respuesta sugerida para copiar, los datos clave, si hay que escalar y los datos del ticket (asunto, categoría y prioridad).`;

      const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: ANSWER_SCHEMA,
      });

      const answer = typeof llm === 'string' ? JSON.parse(llm) : llm;
      return Response.json({ ok: true, answer });
    }

    // escalate
    const supervisor = String(body.supervisor_email || '').trim();
    if (!supervisor) return Response.json({ error: 'Falta el supervisor asignado' }, { status: 400 });

    const subject = short(body.subject, 200) || `Caso de ${context.cliente.nombre}`;
    const summary = short(body.summary, 1500);
    const question = short(body.question, 1500);

    const transcript = (Array.isArray(body.transcript) ? body.transcript : [])
      .slice(-12)
      .map((entry: any) => `• ${entry?.label || 'Nota'}: ${short(entry?.text, 800)}`)
      .join('\n');

    const caseMessage = [
      '📋 Caso escalado desde el Asistente ATC',
      '',
      `Resumen: ${summary || 'Sin resumen adicional.'}`,
      question ? `Pregunta original del cliente: ${question}` : null,
      '',
      'Guía de la conversación (asistente ↔ ATC):',
      transcript || 'Sin intercambio registrado.',
      '',
      `Historial del cliente: ${context.resumen.paquetes_registrados} paquete(s), ${context.resumen.recibos_cbm_total} CBM en recibos, ${context.resumen.facturas_pendientes} factura(s) con saldo (${context.resumen.saldo_pendiente_usd} USD).`,
    ]
      .filter((line) => line !== null)
      .join('\n');

    const nowIso = new Date().toISOString();
    const ticketNumber = `TKT-${Date.now()}`;

    const ticket = await base44.asServiceRole.entities.SupportTicket.create({
      ticket_number: ticketNumber,
      client_email: clientEmail,
      subject,
      category: body.category || 'otro',
      priority: body.priority || 'media',
      status: 'abierto',
      related_tracking: body.related_tracking || null,
      assigned_to: supervisor,
      messages: [
        {
          sender_email: user.email,
          sender_name: `${user.full_name || user.email} (ATC)`,
          message: caseMessage,
          timestamp: nowIso,
          is_admin: true,
        },
        {
          sender_email: user.email,
          sender_name: 'Sistema',
          message: `Ticket asignado a ${supervisor} para supervisión.`,
          timestamp: nowIso,
          is_admin: true,
          is_system: true,
        },
      ],
    });

    await base44.asServiceRole.entities.Notification.create({
      user_email: supervisor,
      title: '🎫 Caso escalado desde el Asistente ATC',
      message: `${subject} · Cliente: ${context.cliente.nombre} (${clientEmail})`,
      type: 'general',
      icon: 'alert',
      reference_id: ticketNumber,
    }).catch(() => null);

    return Response.json({ ok: true, ticket_number: ticketNumber, ticket_id: ticket?.id || null, assigned_to: supervisor });
  } catch (error) {
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
}