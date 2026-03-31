import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const topics = [
      'Tiempos y costos: envío marítimo vs aéreo China → Venezuela',
      'Guía de consolidación para ahorrar en CBM desde China',
      'Checklist aduanero para importar a Venezuela desde China',
      'Cómo elegir proveedores en China y evitar fraudes',
      'Tendencias de e-commerce transfronterizo China → LATAM'
    ];
    const pick = topics[Math.floor(Math.random() * topics.length)];

    const prompt = `Escribe un artículo de blog en español, orientado a SEO, sobre: "${pick}" para una empresa de logística que envía de China a Venezuela.
- Incluye título (H1), resumen (2-3 líneas), y cuerpo con H2/H3 y listas.
- Enfatiza consolidación, tiempos estimados marítimo/aéreo y trámites.
- Devuelve JSON: {"title","excerpt","content_markdown","tags":[..],"reading_time_minutes"}.`;

    const llm = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      response_json_schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          excerpt: { type: 'string' },
          content_markdown: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          reading_time_minutes: { type: 'number' }
        },
        required: ['title', 'excerpt', 'content_markdown']
      }
    });

    const title = String(llm.title).trim();
    const slug = title.toLowerCase().normalize('NFD').replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-');

    const created = await base44.asServiceRole.entities.BlogPost.create({
      title,
      slug,
      excerpt: llm.excerpt,
      content: llm.content_markdown,
      status: 'published',
      published_at: new Date().toISOString(),
      author_name: 'TLEC Logistics',
      seo_title: title,
      seo_description: llm.excerpt,
      tags: llm.tags || ['china', 'venezuela'],
      reading_time_minutes: llm.reading_time_minutes || 6
    });

    return Response.json({ success: true, post: created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});