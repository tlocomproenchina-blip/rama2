import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const topic = body.topic || 'Noticias de logística y e-commerce China → Venezuela';

    const prompt = `Escribe un artículo de blog en español, orientado a SEO, sobre: "${topic}" para una empresa de logística que envía de China a Venezuela.
- Incluye título atractivo (H1), resumen (2-3 líneas), y cuerpo con secciones H2/H3, listas y consejos prácticos.
- Enfatiza consolidación, tiempos estimados marítimo/aéreo, aduanas y buenas prácticas.
- Cierra con un CTA a calcular tarifas y soporte.
- Devuelve un JSON con: {"title", "excerpt", "content_markdown", "cover_image_prompt", "tags": [..], "reading_time_minutes"}.`;

    const llmRes = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      response_json_schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          excerpt: { type: 'string' },
          content_markdown: { type: 'string' },
          cover_image_prompt: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          reading_time_minutes: { type: 'number' }
        },
        required: ['title', 'excerpt', 'content_markdown']
      }
    });

    const data = llmRes;
    const title = String(data.title).trim();
    const slug = title.toLowerCase().normalize('NFD').replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-');

    const post = await base44.entities.BlogPost.create({
      title,
      slug,
      excerpt: data.excerpt,
      content: data.content_markdown,
      cover_image_url: '',
      tags: data.tags || ['china', 'venezuela', 'logistica'],
      status: 'published',
      published_at: new Date().toISOString(),
      author_name: user.full_name || 'TLEC Logistics',
      seo_title: title,
      seo_description: data.excerpt,
      reading_time_minutes: data.reading_time_minutes || 6
    });

    return Response.json({ success: true, post });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});