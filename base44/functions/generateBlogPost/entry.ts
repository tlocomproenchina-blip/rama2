import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { slugify, estimateReadingTime, BLOG_JSON_SCHEMA, buildArticlePrompt } from '../../shared/blogSeo.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Solo administradores' }, { status: 403 });
    }

    const body = await req.json();
    const topic = body?.topic;
    if (!topic) return Response.json({ error: 'Se requiere el parametro topic' }, { status: 400 });

    const prompt = buildArticlePrompt(topic, false);

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: BLOG_JSON_SCHEMA
    });

    let slug = result.slug || slugify(result.title);
    const existing = await base44.entities.BlogPost.filter({ slug }, undefined, 1);
    if (existing.length > 0) slug = slug + '-' + Date.now().toString(36);

    const post = await base44.entities.BlogPost.create({
      title: result.title,
      slug,
      excerpt: result.excerpt,
      content: result.content,
      seo_title: result.seo_title || result.title,
      seo_description: result.seo_description,
      tags: result.tags || [],
      reading_time_minutes: estimateReadingTime(result.content),
      author_name: 'TLEC CARGO',
      status: 'draft',
      published_at: new Date().toISOString()
    });

    return Response.json({ success: true, post });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}