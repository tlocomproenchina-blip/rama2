import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const AUTO_TAG = 'auto-generado';
const AUTO_PREFIX = '[Auto] ';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const svc = base44.asServiceRole;

    // 1. Recolectar SupportTickets de los últimos 30 días
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const tickets = await svc.entities.SupportTicket.filter(
      { created_date: { $gte: thirtyDaysAgo } },
      '-created_date',
      500
    );

    // 2. Recolectar artículos KnowledgeBase publicados con feedback
    const articles = await svc.entities.KnowledgeBase.filter(
      { status: 'published' },
      '-updated_date',
      200
    );

    // 3. Resumir tickets: subject + categoría + primer mensaje del cliente
    const ticketSummaries = (tickets || []).slice(0, 200).map((t: any) => {
      const clientMsgs = (t.messages || []).filter((m: any) => !m.is_admin);
      const firstMsg = clientMsgs[0]?.message || '';
      return {
        subject: t.subject,
        category: t.category,
        message: firstMsg.slice(0, 300)
      };
    });

    // 4. Artículos con feedback negativo o bajo helpful
    const articlesWithFeedback = (articles || []).map((a: any) => ({
      id: a.id,
      title: a.title,
      category: a.category,
      helpful_count: a.helpful_count || 0,
      not_helpful_count: a.not_helpful_count || 0,
      content_preview: (a.content || '').slice(0, 200)
    }));

    // 5. Si no hay tickets ni feedback, no hay nada que renovar
    if (ticketSummaries.length === 0 && articlesWithFeedback.filter(a => a.not_helpful_count > 0).length === 0) {
      return Response.json({
        status: 'skipped',
        reason: 'No hay interacciones ni feedback suficiente para renovar la KnowledgeBase este mes.',
        tickets_analyzed: 0,
        articles_reviewed: articlesWithFeedback.length
      });
    }

    // 6. Armar prompt para InvokeLLM
    const prompt = `Eres un analista de soporte para TLEC CARGO, una empresa de envíos China-Venezuela.
Analiza las interacciones de clientes (tickets de soporte) y el feedback de artículos existentes para renovar la base de conocimientos (KnowledgeBase).

**Tickets de soporte de los últimos 30 días (preguntas reales de clientes):**
${JSON.stringify(ticketSummaries, null, 2)}

**Artículos actuales de la KnowledgeBase (con feedback de utilidad):**
${JSON.stringify(articlesWithFeedback, null, 2)}

**Tu tarea:**
1. Identifica temas recurrentes en los tickets (preguntas que aparecen múltiples veces o categorías frecuentes).
2. Identifica brechas de conocimiento: temas con tickets pero sin artículo que los cubra.
3. Identifica artículos con feedback negativo (not_helpful_count alto) que necesitan mejorarse.
4. Propone NUEVOS artículos para las brechas detectadas.
5. Propone ACTUALIZACIONES de contenido complementario para artículos existentes que recibieron feedback negativo o que cubren temas con muchos tickets.

**Reglas:**
- Los nuevos artículos deben tener un título claro, contenido en Markdown en español, y una categoría válida (general, envios, pagos, soporte, faqs, politicas).
- Las actualizaciones deben incluir el ID del artículo existente y el nuevo contenido COMPLEMENTARIO (no reemplazo, sino información adicional que aclare dudas).
- Máximo 5 artículos nuevos y 5 actualizaciones por ejecución.
- No dupliques temas ya cubiertos adecuadamente por artículos con feedback positivo.

Responde en formato JSON según el schema proporcionado.`;

    const responseSchema = {
      type: 'object',
      properties: {
        new_articles: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              content: { type: 'string' },
              category: { type: 'string', enum: ['general', 'envios', 'pagos', 'soporte', 'faqs', 'politicas'] },
              tags: { type: 'array', items: { type: 'string' } },
              reason: { type: 'string' }
            },
            required: ['title', 'content', 'category']
          }
        },
        updates: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              article_id: { type: 'string' },
              additional_content: { type: 'string' },
              reason: { type: 'string' }
            },
            required: ['article_id', 'additional_content']
          }
        },
        summary: { type: 'string' }
      },
      required: ['new_articles', 'updates', 'summary']
    };

    const llmResponse = await svc.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: responseSchema
    });

    const result = llmResponse as any;
    const newArticles = result.new_articles || [];
    const updates = result.updates || [];
    const summary = result.summary || '';

    // 7. Crear nuevos artículos (status published, tag auto-generado)
    const createdArticles = [];
    for (const art of newArticles.slice(0, 5)) {
      try {
        const created = await svc.entities.KnowledgeBase.create({
          title: AUTO_PREFIX + art.title,
          content: art.content,
          category: art.category,
          tags: [...(art.tags || []), AUTO_TAG],
          status: 'published',
          helpful_count: 0,
          not_helpful_count: 0
        });
        createdArticles.push({ id: created.id, title: created.title });
      } catch (e) {
        console.error('Error creando artículo:', e);
      }
    }

    // 8. Actualizar artículos existentes con contenido complementario
    const updatedArticles = [];
    for (const upd of updates.slice(0, 5)) {
      try {
        const existing = articles.find((a: any) => a.id === upd.article_id);
        if (!existing) continue;
        // Append complementary content
        const separator = '\n\n---\n\n**Información complementaria:**\n\n';
        const newContent = (existing.content || '') + separator + upd.additional_content;
        await svc.entities.KnowledgeBase.update(upd.article_id, {
          content: newContent,
          tags: [...(existing.tags || []), AUTO_TAG + '-actualizado']
        });
        updatedArticles.push({ id: upd.article_id, title: existing.title });
      } catch (e) {
        console.error('Error actualizando artículo:', e);
      }
    }

    // 9. Notificar admins (no bloqueante)
    try {
      const admins = await svc.entities.User.filter({ role: 'admin' }, '-created_date', 50);
      const adminEmails = (admins || []).map((a: any) => a.email).filter(Boolean);
      const notifBody = `Renovación mensual de KnowledgeBase completada:\n\n${summary}\n\nNuevos artículos creados: ${createdArticles.length}\n${createdArticles.map(a => `- ${a.title}`).join('\n')}\n\nArtículos actualizados: ${updatedArticles.length}\n${updatedArticles.map(a => `- ${a.title}`).join('\n')}\n\nTickets analizados: ${ticketSummaries.length}`;

      for (const email of adminEmails) {
        await svc.entities.Notification.create({
          user_email: email,
          title: '🧠 KnowledgeBase renovada',
          message: `Renovación mensual: ${createdArticles.length} nuevos, ${updatedArticles.length} actualizados.`,
          type: 'system',
          icon: 'info',
          priority: 'low'
        });
      }
    } catch (e) {
      console.error('Error notificando admins:', e);
    }

    return Response.json({
      status: 'success',
      tickets_analyzed: ticketSummaries.length,
      articles_reviewed: articlesWithFeedback.length,
      new_articles_created: createdArticles.length,
      articles_updated: updatedArticles.length,
      summary
    });
  } catch (error) {
    console.error('Error en renewKnowledgeBase:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}