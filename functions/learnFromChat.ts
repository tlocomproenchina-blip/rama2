import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { question, answer } = await req.json().catch(() => ({ question: '', answer: '' }));
    if (!question || !answer) {
      return Response.json({ error: 'Missing question or answer' }, { status: 400 });
    }

    // Pedimos al LLM que estructure un artículo breve de KB a partir del Q&A
    const kbDraft = await base44.integrations.Core.InvokeLLM({
      prompt: `Eres un asistente que convierte interacciones de soporte (pregunta y respuesta) en artículos de una base de conocimientos.

Devuelve un JSON con este esquema y nada más:
{
  "title": string,            // Título conciso en español (máx 80 chars)
  "content": string,          // Respuesta clara en 3-6 frases, en Markdown simple
  "category": string,         // Una de: general, envios, pagos, soporte, faqs, politicas
  "tags": string[]            // 2 a 5 etiquetas en minúsculas
}

Ten en cuenta:
- Sé neutral y directo, sin emojis.
- Si la pregunta es de precios/envíos, usa la categoría "envios"; si es trámite/pagos, "pagos"; dudas generales, "faqs"; problemas de uso, "soporte".
- No incluyas datos personales del usuario ni IDs internos.

PREGUNTA:\n${question}\n\nRESPUESTA:\n${answer}`,
      response_json_schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          content: { type: 'string' },
          category: { type: 'string', enum: ['general','envios','pagos','soporte','faqs','politicas'] },
          tags: { type: 'array', items: { type: 'string' } }
        },
        required: ['title','content']
      }
    });

    const title = (kbDraft?.title || '').trim().slice(0, 80) || 'Artículo de ayuda';
    const content = (kbDraft?.content || String(answer)).trim();
    const category = (kbDraft?.category || 'faqs');
    const tags = Array.isArray(kbDraft?.tags) ? kbDraft.tags.map(t => String(t).toLowerCase().slice(0, 30)).slice(0, 6) : [];

    // Deduplicación básica por título exacto
    let createdOrUpdated;
    try {
      const existing = await base44.entities.KnowledgeBase.filter({ title }, '-updated_date', 1);
      if (existing && existing[0]) {
        const prev = existing[0];
        const mergedTags = Array.from(new Set([...(prev.tags || []), ...tags]));
        createdOrUpdated = await base44.entities.KnowledgeBase.update(prev.id, {
          content,
          category,
          tags: mergedTags,
          status: 'published'
        });
      } else {
        createdOrUpdated = await base44.entities.KnowledgeBase.create({
          title,
          content,
          category,
          tags,
          status: 'published'
        });
      }
    } catch (e) {
      // Si falla la entidad por cualquier razón, devolvemos 500
      return Response.json({ error: e?.message || 'KB write failed' }, { status: 500 });
    }

    return Response.json({ success: true, record: createdOrUpdated });
  } catch (error) {
    return Response.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
});