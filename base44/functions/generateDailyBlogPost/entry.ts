import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { slugify, estimateReadingTime, BLOG_JSON_SCHEMA, buildArticlePrompt, buildImagePrompt, pickRandomTopics } from '../../shared/blogSeo.ts';
import { callGeminiJSON, toGeminiSchema } from '../../shared/geminiClient.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Solo administradores' }, { status: 403 });
    }

    const topic = pickRandomTopics(1)[0];
    const prompt = buildArticlePrompt(topic, true);

    const result = await callGeminiJSON(prompt, toGeminiSchema(BLOG_JSON_SCHEMA));

    const imageResult = await base44.integrations.Core.GenerateImage({
      prompt: buildImagePrompt(result.title, result.image_prompt)
    });

    let slug = result.slug || slugify(result.title);
    const existing = await base44.entities.BlogPost.filter({ slug }, undefined, 1);
    if (existing.length > 0) slug = slug + '-' + Date.now().toString(36);

    const post = await base44.entities.BlogPost.create({
      title: result.title,
      slug,
      excerpt: result.excerpt,
      content: result.content,
      cover_image_url: imageResult.url,
      seo_title: result.seo_title || result.title,
      seo_description: result.seo_description,
      tags: result.tags || [],
      reading_time_minutes: estimateReadingTime(result.content),
      author_name: 'TLEC CARGO',
      status: 'published',
      published_at: new Date().toISOString()
    });

    return Response.json({ success: true, post, topic });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}