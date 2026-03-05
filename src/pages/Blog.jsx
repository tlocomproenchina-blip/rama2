import React from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Blog() {
  React.useEffect(() => {
    document.title = 'Blog | Logística China → Venezuela | TLEC Logistics';
    const meta = document.querySelector('meta[name="description"]') || document.createElement('meta');
    meta.name = 'description';
    meta.content = 'Noticias y guías sobre envíos China → Venezuela: tarifas, tiempos, aduanas y mejores prácticas.';
    document.head.appendChild(meta);
  }, []);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['blog-posts'],
    queryFn: async () => {
      const list = await base44.entities.BlogPost.filter({ status: 'published' }, '-published_at', 30);
      return list;
    },
    staleTime: 60_000,
  });

  return (
    <div className="min-h-[60vh]">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">Blog: China → Venezuela</h1>
        {isLoading ? (
          <p className="text-slate-600">Cargando artículos…</p>
        ) : posts.length === 0 ? (
          <div className="text-slate-600">Aún no hay publicaciones.</div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {posts.map((p) => (
              <Card key={p.id} className="overflow-hidden">
                {p.cover_image_url && (
                  <img src={p.cover_image_url} alt={p.title} className="h-44 w-full object-cover" />
                )}
                <CardHeader>
                  <CardTitle className="text-xl font-semibold line-clamp-2">{p.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600 line-clamp-3 mb-4">{p.excerpt}</p>
                  <div className="flex items-center justify-between text-sm text-slate-500">
                    <span>{p.published_at ? new Date(p.published_at).toLocaleDateString() : ''}</span>
                    <span>{p.reading_time_minutes ? `${Math.round(p.reading_time_minutes)} min` : ''}</span>
                  </div>
                  <div className="mt-4">
                    <Link to={createPageUrl('BlogPost') + `?slug=${encodeURIComponent(p.slug)}`}>
                      <Button variant="outline">Leer más</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}