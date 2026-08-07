import React from 'react';
import { base44 } from '@/components/api/ApiQueueManager'; // Página pública para SEO

export default function BlogPost() {
  const [post, setPost] = React.useState(null);
  const [status, setStatus] = React.useState('loading');

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');
    const id = params.get('id');

    async function load() {
      try {
        let data = null;
        if (slug) {
          const res = await base44.entities.BlogPost.filter({ slug, status: 'published' }, '-published_at', 1);
          data = res[0] || null;
        } else if (id) {
          const res = await base44.entities.BlogPost.filter({ id, status: 'published' }, undefined, 1);
          data = res[0] || null;
        }
        if (!data) { setStatus('not_found'); return; }
        setPost(data);
        setStatus('ready');

        document.title = (data.seo_title || data.title) + ' | TLEC CARGO';
        const pageUrl = window.location.href;
        const desc = data.seo_description || data.excerpt || '';
        const img = data.cover_image_url || '';
        const titleSEO = data.seo_title || data.title;

        const setMeta = (attr, key, content) => {
          if (!content) return;
          let el = document.querySelector(`meta[${attr}="${key}"]`);
          if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
          el.content = content;
        };

        setMeta('name', 'description', desc);
        setMeta('property', 'og:title', titleSEO);
        setMeta('property', 'og:description', desc);
        setMeta('property', 'og:type', 'article');
        setMeta('property', 'og:url', pageUrl);
        setMeta('property', 'og:image', img);
        setMeta('property', 'og:site_name', 'TLEC CARGO');
        setMeta('name', 'twitter:card', 'summary_large_image');
        setMeta('name', 'twitter:title', titleSEO);
        setMeta('name', 'twitter:description', desc);
        setMeta('name', 'twitter:image', img);

        let canonical = document.querySelector('link[rel="canonical"]');
        if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
        canonical.href = data.canonical_url || pageUrl;

        const oldJsonLd = document.getElementById('blogpost-jsonld');
        if (oldJsonLd) oldJsonLd.remove();
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.id = 'blogpost-jsonld';
        script.textContent = JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: titleSEO,
          description: desc,
          image: img ? [img] : undefined,
          datePublished: data.published_at,
          dateModified: data.published_at,
          author: { '@type': 'Organization', name: data.author_name || 'TLEC CARGO' },
          publisher: { '@type': 'Organization', name: 'TLEC CARGO' },
          mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl }
        });
        document.head.appendChild(script);
      } catch (e) {
        setStatus('error');
      }
    }
    load();
  }, []);

  if (status === 'loading') return <div className="text-slate-600">Cargando…</div>;
  if (status === 'not_found') return <div className="text-slate-600">Artículo no encontrado.</div>;
  if (status === 'error') return <div className="text-slate-600">Error al cargar el artículo.</div>;

  return (
    <article className="prose prose-slate max-w-3xl">
      {post.cover_image_url && (
        <img src={post.cover_image_url} alt={post.title} className="w-full rounded-xl border mb-6" />
      )}
      <h1>{post.title}</h1>
      {post.excerpt && <p className="lead">{post.excerpt}</p>}
      <div className="text-sm text-slate-500 mt-2">
        {post.published_at ? new Date(post.published_at).toLocaleDateString() : ''}
        {post.author_name ? ` • ${post.author_name}` : ''}
      </div>
      <div className="mt-6 whitespace-pre-wrap">{post.content}</div>
    </article>
  );
}