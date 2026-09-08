import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import OpenAI from 'npm:openai';
import { secrets } from 'base44:runtime';

const SYSTEM_PROMPT = `Eres el asistente de soporte de TLEC CARGO, un sistema de envíos entre China y Venezuela.

REGLAS CRÍTICAS DE SEGURIDAD Y PRIVACIDAD:
1. Solo puedes ver y mencionar información de la cuenta del cliente que está chateando contigo ahora mismo.
2. NUNCA compartas información sobre otros clientes, administradores, empleados o proveedores.
3. Si te preguntan sobre datos de otra persona, responde que no puedes compartir información de otras cuentas.
4. No inventes datos que no estén en el contexto proporcionado.
5. Si no tienes la información necesaria, sugiere crear un ticket de soporte.

INSTRUCCIONES:
- Responde en español, de forma natural, amigable y concisa
- Usa los datos de la cuenta del cliente para responder preguntas sobre sus paquetes, tracking, facturas y consolidaciones
- Usa los artículos de la base de conocimiento para preguntas generales sobre procesos, tarifas, políticas
- Si el cliente necesita ayuda humana que no puedes dar, sugiere crear un ticket de soporte
- Formatea respuestas con markdown cuando sea útil (listas, negritas)
- Mantén las respuestas breves, máximo 3-4 párrafos`;

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

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { messages = [], query = '' } = body as { messages: any[]; query: string };

    // Fetch user's data in parallel — RLS enforces isolation (only this user's records)
    const [packages, invoices, consolidations, kbArticles] = await Promise.all([
      base44.entities.Package.filter({ client_email: user.email }, '-created_date', 20).catch(() => []),
      base44.entities.Invoice.filter({ client_email: user.email }, '-created_date', 10).catch(() => []),
      base44.entities.Consolidation.filter({ client_email: user.email }, '-created_date', 5).catch(() => []),
      base44.entities.KnowledgeBase.filter({ status: 'published' }, '-updated_date', 50).catch(() => [])
    ]);

    const statusLabels: Record<string, string> = {
      pre_alerta: 'Pre-alerta', recibido: 'Recibido', rechazado: 'Rechazado',
      consolidado: 'Consolidado', en_transito: 'En tránsito',
      disponible: 'Disponible', despachado: 'Despachado', entregado: 'Entregado'
    };

    const invoiceStatusLabels: Record<string, string> = {
      pendiente: 'Pendiente', revision: 'Revisión', pagada: 'Pagada',
      vencida: 'Vencida', cancelada: 'Cancelada'
    };

    const context = {
      cliente: {
        nombre: user.full_name,
        email: user.email,
        shipping_mark: user.shipping_mark || 'No asignado',
        ciudad: user.city
      },
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
      { role: 'system', content: SYSTEM_PROMPT + '\n\nDATOS DE LA CUENTA DEL CLIENTE:\n' + JSON.stringify(context) }
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

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: openaiMessages,
      max_tokens: 800,
      temperature: 0.5
    });

    const aiResponse = response.choices[0].message.content;
    const suggestedArticles = findRelevantArticles(kbArticles || [], query, 3);

    return Response.json({
      response: aiResponse,
      suggested_articles: suggestedArticles
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}