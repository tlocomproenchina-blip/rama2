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

// Similarity helpers to prevent duplicate topics
function normalizeText(s) { return (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim(); }
function tokenSet(s) { return new Set(normalizeText(s).split(' ').filter(Boolean)); }
function jaccardSim(a, b) {
  const A = tokenSet(a), B = tokenSet(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0; for (const x of A) { if (B.has(x)) inter++; }
  const union = new Set([...A, ...B]).size;
  return inter / union;
}
function isTooSimilar(title, existingTitles) {
  const t = normalizeText(title);
  for (const e of existingTitles) {
    const en = normalizeText(e);
    if (!en) continue;
    if (t === en) return true;
    if ((t.includes(en) || en.includes(t)) && Math.min(t.length, en.length) >= 20) return true;
    if (jaccardSim(title, e) >= 0.8) return true;
  }
  return false;
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

    // Get recent posts to avoid duplication
    const recent = await base44.asServiceRole.entities.BlogPost.list('-updated_date', 20);
    const recentTitles = (recent || []).map(p => p.title).filter(Boolean).slice(0, 15);
    const avoidText = recentTitles.map((t,i) => `${i+1}. ${t}`).join('\n');

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

    let finalPrompt = `Eres un analista de contenidos logísticos. FECHA: ${dateStr}.
Investiga HOY en la web (ES/EN/中文) sobre: ${topic}.

Evita repetir temas o ángulos similares a los últimos artículos:
${avoidText || '- (sin historial)'}

Instrucciones:
- Selecciona un enfoque NOTORIAMENTE distinto y actual.
- Usa datos recientes y fuentes citables (menciona el medio/informe cuando aporte claridad).
- Redacta en español neutro.

Devuelve JSON con:
* title (≤70)
* excerpt (120–160)
* content_markdown (H2/H3, listas, tablas si aplica; incluye "Conclusiones" y "Recomendaciones prácticas")
* seo_title, seo_description
* tags (3–7)
* cover_image_prompt (breve, sin texto)

Evita plagio, reescribe con tus palabras y verifica coherencia factual.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: finalPrompt,
      add_context_from_internet: true,
      response_json_schema: llmSchema
    });

    let data = result || {};
    let title = (data.title || `Actualización logística ${dateStr}`).trim();

    // Retry up to 2 times if too similar to recent posts
    let attempts = 1;
    while (isTooSimilar(title, recentTitles) && attempts < 3) {
      const refinePrompt = `${finalPrompt}\n\nIMPORTANTE:\n- Evita duplicar o reescribir temas similares a estos títulos recientes (no repitas ángulo ni estructura):\n${avoidText}\n- Cambia sustancialmente el enfoque (mercados, normativa, rutas, costos, casos reales, riesgos, estacionalidad).\n- Propón un título claramente diferente.`;
      const retry = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: refinePrompt,
        add_context_from_internet: true,
        response_json_schema: llmSchema
      });
      if (retry) data = retry;
      title = (data.title || `Actualización logística ${dateStr}`).trim();
      attempts++;
    }

    const slugBase = slugify(title);

    // Ensure unique slug
    let slug = slugBase || `blog-${dateStr}`;
    const existingWithSameSlug = await base44.asServiceRole.entities.BlogPost.filter({ slug }, undefined, 1);
    if (existingWithSameSlug.length > 0) {
      slug = `${slugBase}-${today.getTime()}`;
    }

    // If still similar after retries, append a differentiator to title
    if (isTooSimilar(title, recentTitles)) {
      const diff = ['Panorama regional', 'Perspectiva regulatoria', 'Análisis de costos', 'Casos reales', 'Tendencias 2026'][Math.floor(Math.random()*5)];
      title = `${title} — ${diff}`;
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
      seo_title: data.seo_title || title,
      seo_description: data.seo_description || (data.excerpt || ''),
      status: 'draft',
      published_at: new Date().toISOString(),
      author_name: 'TLEC CARGO',
      reading_time_minutes: Math.max(1, Math.round(((data.content_markdown || '').split(/\s+/).filter(Boolean).length) / 200))
    };

    const created = await base44.asServiceRole.entities.BlogPost.create(postPayload);

    return Response.json({ success: true, id: created.id, slug: created.slug, status: created.status, published_at: created.published_at });
  } catch (error) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});