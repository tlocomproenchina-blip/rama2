import React from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom'; // SEO público
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, Loader2 } from 'lucide-react';
import PublicPageShell from '@/components/public/PublicPageShell';

export default function Blog() {
  React.useEffect(() => {
    document.title = 'Blog | Logística China → Venezuela | IMPORTACIONES TLEC CARGO';
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
    <PublicPageShell
      eyebrow="Blog"
      title="Blog: China → Venezuela"
      description="Guías y noticias sobre envíos, tarifas, tiempos y aduanas para importar con confianza."
      width="max-w-6xl"
    >
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : posts.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">Aún no hay publicaciones.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <Link key={p.id} to={createPageUrl('BlogPost') + `?slug=${encodeURIComponent(p.slug)}`} className="group">
              <Card className="h-full overflow-hidden transition-all duration-200 group-hover:-translate-y-1 group-hover:border-primary/50 group-hover:shadow-premium">
                {p.cover_image_url && (
                  <img src={p.cover_image_url} alt={p.title} className="h-44 w-full object-cover" />
                )}
                <CardContent className="p-5">
                  <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                    <span>{p.published_at ? new Date(p.published_at).toLocaleDateString() : ''}</span>
                    <span>{p.reading_time_minutes ? `${Math.round(p.reading_time_minutes)} min` : ''}</span>
                  </div>
                  <h2 className="mt-2 line-clamp-2 font-display text-lg font-bold text-foreground">{p.title}</h2>
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{p.excerpt}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-link">
                    Leer más <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </PublicPageShell>
  );
}