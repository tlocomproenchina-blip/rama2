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
        const meta = document.querySelector('meta[name="description"]') || document.createElement('meta');
        meta.name = 'description';
        meta.content = data.seo_description || data.excerpt || '';
        document.head.appendChild(meta);
        if (data.canonical_url) {
          let link = document.querySelector('link[rel="canonical"]');
          if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
          link.href = data.canonical_url;
        }
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