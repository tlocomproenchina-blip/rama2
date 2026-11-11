import React from 'react';
import { base44 } from '@/components/api/ApiQueueManager'; // Página pública para SEO
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import PublicPageShell from '@/components/public/PublicPageShell';
import BlogMarkdown from '@/components/blog/BlogMarkdown';

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

        document.title = (data.seo_title || data.title) + ' | IMPORTACIONES TLEC CARGO';
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
        setMeta('property', 'og:site_name', 'IMPORTACIONES TLEC CARGO');
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
          author: { '@type': 'Organization', name: data.author_name || 'IMPORTACIONES TLEC CARGO' },
          publisher: { '@type': 'Organization', name: 'IMPORTACIONES TLEC CARGO' },
          mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl }
        });
        document.head.appendChild(script);
      } catch (e) {
        setStatus('error');
      }
    }
    load();
  }, []);

  if (status !== 'ready') {
    const message = status === 'loading' ? 'Cargando…' : status === 'not_found' ? 'Artículo no encontrado.' : 'Error al cargar el artículo.';
    return <PublicPageShell eyebrow="Blog" title={message} width="max-w-3xl" />;
  }

  return (
    <PublicPageShell eyebrow="Blog" title={post.title} description={post.excerpt} width="max-w-3xl">
      <article>
        <p className="text-sm text-muted-foreground">
          {post.published_at ? new Date(post.published_at).toLocaleDateString() : ''}
          {post.author_name ? ` • ${post.author_name}` : ''}
        </p>
        {post.cover_image_url && (
          <img src={post.cover_image_url} alt={post.title} className="mt-6 w-full rounded-2xl border border-border" />
        )}
        <BlogMarkdown content={post.content} />
        <Link to="/Blog" className="mt-10 inline-flex items-center gap-1.5 text-sm font-semibold text-link hover:underline">
          <ArrowLeft className="h-4 w-4" /> Volver al blog
        </Link>
      </article>
    </PublicPageShell>
  );
}