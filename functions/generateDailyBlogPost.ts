import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function slugify(text) {
  return (text || '')
    .toString()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // If invoked by a user, restrict to admins only; allow service (no user) for automations
    let user = null;
    try { user = await base44.auth.me(); } catch (_) {}
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Optional topic override from payload
    let payload = {};
    try { payload = await req.json(); } catch (_) { payload = {}; }
    const topic = payload?.topic || 'logística internacional China a Venezuela/LatAm, tiempos, costos, aduanas, normativa, tips prácticos';

    const today = new Date();
    const dateStr = today.toISOString().slice(0,10);

    const llmSchema = {
      type: 'object',
      properties: {
        title: { type: 'string' },
        excerpt: { type: 'string' },
        content_markdown: { type: 'string' },
        seo_title: { type: 'string' },
        seo_description: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        cover_image_prompt: { type: 'string' }
      },
      required: ['title','excerpt','content_markdown']
    };

    const prompt = `Eres un analista de contenidos logísticos. Investiga HOY en la web (incluye fuentes en español, inglés y chino) sobre: ${topic}.
- Usa datos recientes y confiables (cita nombres de fuentes dentro del texto cuando aporte claridad).
- Redacta la salida FINAL en español neutro.
- Devuelve:
  * title (máx. ~70 chars, claro y atractivo)
  * excerpt (120–160 chars, estilo meta description)
  * content_markdown (estructura con H2/H3, listas, tablas si aplica; añade un bloque de “Conclusiones” y otro de “Recomendaciones prácticas”)
  * seo_title y seo_description
  * tags (3–7 palabras clave)
  * cover_image_prompt (descripción breve para una imagen representativa, sin texto sobreimpreso)
Evita plagio, reescribe con tus palabras y verifica coherencia factual.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      response_json_schema: llmSchema
    });

    const data = result || {};
    const title = (data.title || `Actualización logística ${dateStr}`).trim();
    const slugBase = slugify(title);

    // Ensure unique slug
    let slug = slugBase || `blog-${dateStr}`;
    const existingWithSameSlug = await base44.asServiceRole.entities.BlogPost.filter({ slug }, undefined, 1);
    if (existingWithSameSlug.length > 0) {
      slug = `${slugBase}-${today.getTime()}`;
    }

    // Cover image generation (required: retry + fallback)
    let coverUrl = '';
    const basePrompt = data.cover_image_prompt || `Logística internacional China a Venezuela, contenedores, carga aérea y marítima, estilo fotorrealista, luz suave`;
    try {
      const img = await base44.asServiceRole.integrations.Core.GenerateImage({ prompt: basePrompt });
      coverUrl = img?.url || '';
      if (!coverUrl) {
        const alt = await base44.asServiceRole.integrations.Core.GenerateImage({ prompt: `Imagen representativa: ${title}. Estilo fotorrealista, iluminación suave, sin texto.` });
        coverUrl = alt?.url || '';
      }
    } catch (_) {
      try {
        const alt = await base44.asServiceRole.integrations.Core.GenerateImage({ prompt: `Imagen representativa: ${title}. Estilo fotorrealista, iluminación suave, sin texto.` });
        coverUrl = alt?.url || '';
      } catch (_) { /* ignore */ }
    }
    if (!coverUrl) {
      coverUrl = 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80';
    }

    const postPayload = {
      title,
      slug,
      excerpt: data.excerpt || '',
      content: data.content_markdown || '',
      cover_image_url: coverUrl,
      tags: Array.isArray(data.tags) ? data.tags : [],
      seo_title: title,
      seo_description: data.seo_description || (data.excerpt || ''),
      status: 'draft',
      author_name: 'TLEC Logistics',
      reading_time_minutes: Math.max(1, Math.round(((data.content_markdown || '').split(/\s+/).filter(Boolean).length) / 200))
    };

    const created = await base44.asServiceRole.entities.BlogPost.create(postPayload);

    return Response.json({ success: true, id: created.id, slug: created.slug, status: created.status });
  } catch (error) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});