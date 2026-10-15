import React, { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ClipboardList, Loader2, Search, X } from 'lucide-react';
import PublicGuidesHeader from '@/components/public-guides/PublicGuidesHeader';
import PublicGuidesSummary from '@/components/public-guides/PublicGuidesSummary';
import PublicGuideCard from '@/components/public-guides/PublicGuideCard';

const PAGE_SIZE = 20;

// Portal público de guías de despacho: pantalla de solo lectura, sin sesión y sin
// clave. El servidor decide qué datos salen y resuelve la búsqueda por cliente,
// shipping mark, número de guía o código de bulto.
export default function PublicDispatchGuides() {
  const [draft, setDraft] = useState('');
  const [applied, setApplied] = useState('');
  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const nextSkip = useRef(0);

  const runQuery = useCallback(async ({ query, skip = 0, append = false }) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('publicDispatchGuides', {
        query,
        limit: PAGE_SIZE,
        skip,
      });
      const data = res?.data || {};
      if (data?.error) throw new Error(data.error);
      const incoming = Array.isArray(data.guides) ? data.guides : [];
      setGuides((prev) => (append
        ? [...prev, ...incoming.filter((guide) => !prev.some((seen) => seen.id === guide.id))]
        : incoming));
      setHasMore(!!data.has_more);
      nextSkip.current = Number(data.next_skip) || 0;
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'No se pudieron consultar las guías');
      if (!append) setGuides([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    runQuery({ query: '' });
  }, [runQuery]);

  const search = () => {
    const term = draft.trim();
    setApplied(term);
    runQuery({ query: term });
  };

  const clear = () => {
    setDraft('');
    setApplied('');
    runQuery({ query: '' });
  };

  const loadMore = () => {
    if (!hasMore) return;
    runQuery({ query: applied, skip: nextSkip.current, append: true });
  };

  const totals = guides.reduce(
    (acc, guide) => ({
      guides: acc.guides + 1,
      clients: acc.clients + (Number(guide.totals?.clients) || 0),
      bultos: acc.bultos + (Number(guide.totals?.bultos) || 0),
      packages: acc.packages + (Number(guide.totals?.packages) || 0),
    }),
    { guides: 0, clients: 0, bultos: 0, packages: 0 }
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-6 md:py-8">
        <PublicGuidesHeader />

        <div className="rounded-2xl border border-border bg-card p-3 md:p-4">
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              search();
            }}
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-10"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Cliente, shipping mark, número de guía o bulto…"
                aria-label="Buscar guías por cliente"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={loading} className="flex-1 sm:flex-none">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Buscar
              </Button>
              {applied && (
                <Button type="button" variant="ghost" onClick={clear} disabled={loading}>
                  <X className="h-4 w-4" /> Limpiar
                </Button>
              )}
            </div>
          </form>
        </div>

        {error && (
          <p className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800">{error}</p>
        )}

        {guides.length > 0 && <PublicGuidesSummary totals={totals} hasMore={hasMore} />}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : guides.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card py-12 text-center text-muted-foreground">
            <ClipboardList className="mx-auto mb-2 h-10 w-10" />
            <p className="text-sm">
              {applied ? `No hay guías para “${applied}”.` : 'Todavía no hay guías de despacho emitidas.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {guides.map((guide) => (
              <PublicGuideCard key={guide.id} guide={guide} />
            ))}
            {hasMore && (
              <Button variant="outline" className="w-full" onClick={loadMore} disabled={loadingMore}>
                {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                Cargar más guías
              </Button>
            )}
          </div>
        )}

        <footer className="pt-2 text-center text-xs text-muted-foreground">
          <p>Vista de solo lectura. TLEC CARGO · Tu carga asegurada desde China hasta Venezuela</p>
        </footer>
      </div>
    </div>
  );
}