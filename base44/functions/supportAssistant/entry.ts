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
1. "diagnostico": qué está pasando según los datos reales del cliente (estado de sus paquetes, recibos, facturas, órdenes de despacho, tickets, notas). Menciona los datos concretos que lo sustentan.
2. "paso_a_seguir": la acción puntual que el ATC debe hacer o verificar AHORA (una sola, la más útil). Si el ATC ya aplicó el paso anterior, propone el siguiente.
3. "requiere_verificacion_almacen": true casi siempre que la consulta sea sobre el paradero o la entrega de una carga, porque solo el almacén puede confirmar lo físico. Marca true cuando se cumpla cualquiera de estas:
   - El cliente pregunta dónde está su carga, cuándo llega o por qué no le ha llegado, y la orden de despacho aparece emitida o despachada.
   - El cliente dice que la carga no ha llegado, que ya le avisaron de la entrega o que sigue esperando.
   - El cliente pregunta por un paquete, bulto o N° de contenedor que no aparece recibido en el sistema.
   Marca false solo cuando la consulta se responde con datos que ya están en el historial (montos, facturas, abonos, pre-alertas, consolidaciones, actualización de datos, políticas): en la duda, pon true, porque es mejor confirmar con el almacén que afirmar algo sin verificar.
   Cuando sea true, completa también:
   - "pasos_verificacion_almacen": de 2 a 4 pasos concretos, en orden, para que el ATC ubique la carga y luego pida la revisión física. Empieza por buscar al cliente y su carga en el sistema como lo haría el almacén: por el N° de contenedor o envío, por el Shipping Mark y por el tracking o etiqueta del bulto; sigue con confirmar en el historial qué dice el sistema de esa orden (recibida, en almacén, despachada, entregada) y en qué almacén está; termina con pedirle al almacén que revise físicamente el N° de contenedor del cliente y responda si la carga sigue allí o ya salió, con la ubicación o etiqueta que la identifica.
   - "mensaje_almacen": mensaje corto, listo para copiar y enviar por WhatsApp al almacén, sin markdown ni firma. Debe traer el N° de contenedor o el tracking, el nombre del cliente y su Shipping Mark, qué debe revisar (si la carga sigue físicamente en almacén) y qué debe responder (si está o ya salió, con la etiqueta o ubicación donde la encontró).
   Si no hace falta verificación física: "requiere_verificacion_almacen": false, "pasos_verificacion_almacen": [] y "mensaje_almacen": "".
4. "respuesta_sugerida": el mensaje listo para copiar y enviar por WhatsApp al cliente, en español venezolano, cálido y profesional, máximo 4 frases, sin markdown, sin listas, sin firma. Mientras la verificación con almacén esté en curso, nunca afirmes que la carga ya se verificó: dile al cliente que estás confirmando con el almacén y que le avisas en cuanto tengas la respuesta.
5. Cuando el ATC pegue la respuesta del almacén, interpreta qué confirmó y continúa: da el siguiente paso para el ATC y la respuesta definitiva al cliente, adaptada a lo que el almacén reportó (si encontró la carga, si ya salió, si no aparece o si hay una novedad).
6. "datos_clave": hasta 4 datos concretos del contexto que respaldan la orientación (tracking, N° de contenedor, estado, monto, fecha). Si la consulta es de costos, incluye la tarifa por CBM del destino y si lleva el recargo x2 por peso.
7. Avanza la conversación: no repitas una respuesta que ya se usó antes en el historial.

POLÍTICA DE ENTREGA Y TARIFAS VIGENTES (manda sobre cualquier texto anterior: las preguntas frecuentes, la base de conocimiento, el historial del cliente y cualquier guía previa):
- NO existe mínimo de envío: aceptamos carga de cualquier volumen, desde un paquete pequeño hasta un contenedor completo. Tampoco hay cantidad mínima de bultos.
- TODOS los envíos son puerta a puerta: la carga se entrega en la dirección del cliente en Venezuela, sin importar su volumen.
- El envío marítimo se cobra por CBM según el estado de destino. La tarifa de cada destino está en el bloque "tarifas" del contexto (tarifa_por_cbm_por_estado): usa esa y ninguna otra.
- RECARGO POR PESO: desde 400 kg inclusive, la tarifa por CBM se cobra al doble (x2). Si la tarifa del destino es 10 USD por CBM, con 400 kg o más pasa a 20 USD por CBM. Por debajo de 400 kg se cobra la tarifa normal.
- NO existe tarifa fija por rango ni mínimo por volumen pequeño: toda la carga, por pequeña que sea, se cobra a su volumen real en CBM con la tarifa del destino (tarifa_por_cbm_por_estado en el contexto).
- Al envío se le suma 1 USD por paquete de recepción en almacén. El seguro va aparte (porcentaje del FOB indicado en el contexto) y solo si la carga está asegurada.
- NO se entrega por MRW ni por Zoom, ni el cliente retira su carga en oficinas de encomiendas. Tampoco existe una tarifa fija por bulto. Si el historial, las preguntas frecuentes, la base de conocimiento o cualquier guía anterior menciona MRW, Zoom, retiro en oficina o un precio por bulto, ese texto está desactualizado: ignóralo y nunca lo repitas ni se lo comuniques al cliente.

CÓMO COTIZAR UN ENVÍO MARÍTIMO (el bloque "tarifas" del contexto es la única fuente de precios):
- Destino: toma la ciudad o el estado de destino que el cliente menciona en su mensaje. Si no lo menciona, usa el estado del cliente que viene en el contexto (tarifas.estado_del_cliente). Si ninguno de los dos está disponible, no des ninguna tarifa: pide el destino y deja ese paso en "paso_a_seguir".
- Volumen y peso: toma el CBM y el peso de los datos concretos del mensaje del cliente (cantidad de paquetes, peso total, medidas). El peso que trae el mensaje manda sobre cualquier otro dato del historial; si no hay peso, no afirmes si aplica el recargo x2 y pide verificarlo con el almacén, donde se registra el peso real.
- Explica el cálculo en la respuesta: tarifa por CBM del destino, si lleva el recargo x2 por peso, el CBM cobrable y el total. Da un importe exacto solo cuando tengas destino, CBM y peso; si falta alguno, explica la regla y di claramente qué falta para cerrar el número.
- La tarifa por CBM y el recargo x2 son solo de carga marítima: para envío aéreo no cotices, indícalo como paso a seguir para que lo valide el área correspondiente.

REGLAS ESTRICTAS:
- Usa SOLO la información del contexto y de las preguntas frecuentes / base de conocimiento. Si un dato no está, dilo y explica al ATC cómo verificarlo.
- NUNCA inventes trackings, montos, fechas ni estados. Nunca prometas fechas de entrega ni exenciones de cobro que no estén en los datos.
- Nada de información de otros clientes.

CUÁNDO ESCALAR (escalar = true, y explica el motivo en "motivo_escalamiento"):
- El cliente pide hablar con un supervisor o hacer un reclamo.
- Pérdida, daño, cobro indebido, diferencia de monto o compensación.
- El caso lleva dos o más vueltas sin resolverse o el cliente está molesto.
- Se necesita una excepción de política, un ajuste manual o información de otra área (contabilidad, logística).
- Falta un dato clave que el ATC no puede obtener (por ejemplo, la foto de recepción o el CBM oficial).
Si el caso solo necesita que el almacén confirme si una carga sigue físicamente, NO escales: guía al ATC con los pasos y el mensaje para el almacén.
Si el caso es una consulta normal que el ATC puede resolver con el historial, escalar = false.

Siempre completa "asunto" con un título corto del caso para el ticket, y elige "categoria" y "prioridad".
Responde siempre en el JSON pedido y todo el texto en español.`;

const ANSWER_SCHEMA = {
  type: 'object',
  properties: {
    diagnostico: { type: 'string' },
    paso_a_seguir: { type: 'string' },
    requiere_verificacion_almacen: { type: 'boolean' },
    pasos_verificacion_almacen: { type: 'array', items: { type: 'string' } },
    mensaje_almacen: { type: 'string' },
    respuesta_sugerida: { type: 'string' },
    datos_clave: { type: 'array', items: { type: 'string' } },
    escalar: { type: 'boolean' },
    motivo_escalamiento: { type: 'string' },
    asunto: { type: 'string' },
    categoria: { type: 'string', enum: ['pago', 'envio', 'tracking', 'consolidacion', 'actualizar_datos', 'otro'] },
    prioridad: { type: 'string', enum: ['baja', 'media', 'alta', 'urgente'] },
  },
  required: ['diagnostico', 'paso_a_seguir', 'requiere_verificacion_almacen', 'respuesta_sugerida', 'escalar', 'asunto', 'categoria', 'prioridad'],
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

    // El ATC puede pegar un mensaje del cliente, la respuesta del almacén o la
    // respuesta interna que dejó el supervisor en el caso.
    const origin = String(body.origin || 'atc').trim() === 'supervisor' ? 'supervisor' : 'atc';

    const context = await buildSupportClientContext(base44, clientEmail);
    if (!context) return Response.json({ error: 'No se encontró el cliente o su historial' }, { status: 404 });

    if (action === 'context') {
      return Response.json({ ok: true, context });
    }

    if (action === 'ask') {
      const question = short(body.question, 2000);
      if (!question) return Response.json({ error: 'Falta la pregunta del cliente' }, { status: 400 });

      const originBlock = origin === 'supervisor'
        ? `

ORIGEN DE LO ÚLTIMO QUE EL ATC PEGÓ: RESPUESTA INTERNA DEL SUPERVISOR.
Ese texto NO es del cliente: es lo que Supervisión dispuso para el ATC y el cliente nunca lo ve. Trátalo así:
- "diagnostico": qué dispuso el supervisor y con qué datos del historial del cliente se relaciona.
- "paso_a_seguir": la indicación de continuidad para el ATC, concreta y en imperativo: qué debe hacer ahora con este caso, qué verificar antes de darlo por cerrado y qué no ofrecerle al cliente.
- "respuesta_sugerida": el mensaje que el ATC le enviará al cliente por WhatsApp, redactado a partir de lo que dispuso el supervisor, sin mencionar al supervisor, sin hablar de revisiones internas y sin copiar texto interno.
- Si lo que el supervisor pide es confirmar el paradero de la carga, aplica igual el paso de verificación con el almacén.`
        : '';

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

LO ÚLTIMO QUE EL ATC ACABA DE PEGAR (el mensaje del cliente, la respuesta del almacén o la respuesta interna del supervisor):
"${question}"
${originBlock}

Devuelve el diagnóstico, el siguiente paso para el ATC, si hay que verificar la carga con el almacén (con sus pasos y su mensaje), la respuesta sugerida para copiar, los datos clave, si hay que escalar y los datos del ticket (asunto, categoría y prioridad).`;

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

    // Fotos y documentos que el ATC adjunta al escalar: se guardan con el caso
    // para que el supervisor los abra desde su módulo.
    const attachments = (Array.isArray(body.attachments) ? body.attachments : [])
      .slice(0, 5)
      .map((entry: any) => {
        const url = short(entry?.url, 600);
        if (!url) return null;
        return {
          url,
          name: short(entry?.name, 120) || 'Adjunto',
          kind: entry?.kind === 'document' ? 'document' : 'image',
          private: Boolean(entry?.private),
        };
      })
      .filter(Boolean);

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
      escalated: true,
      escalation_status: 'pendiente',
      escalated_date: nowIso,
      escalated_by: user.email,
      escalated_by_name: user.full_name || user.email,
      escalation_summary: summary,
      messages: [
        {
          sender_email: user.email,
          sender_name: `${user.full_name || user.email} (ATC)`,
          message: caseMessage,
          timestamp: nowIso,
          is_admin: true,
          attachments,
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
      reference_id: ticket?.id || ticketNumber,
    }).catch(() => null);

    return Response.json({ ok: true, ticket_number: ticketNumber, ticket_id: ticket?.id || null, assigned_to: supervisor });
  } catch (error) {
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
}