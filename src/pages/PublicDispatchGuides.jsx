import React, { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Boxes, Download, Loader2, Printer, Search, X } from 'lucide-react';
import PublicGuidesHeader from '@/components/public-guides/PublicGuidesHeader';
import PublicClientContainersCard from '@/components/public-guides/PublicClientContainersCard';
import { generateContainersReportPdf } from '@/lib/containersReportPdf';
import { normalizeContainerDescription } from '@/lib/containersByClientReport';

const PAGE_SIZE = 12;

// Misma descripción visible que en el informe administrativo: las descripciones
// genéricas se muestran como "Artículos varios".
const normalizeClients = (clients = []) =>
  clients.map((client) => ({
    ...client,
    containers: (client.containers || []).map((row) => ({
      ...row,
      description: normalizeContainerDescription(row.description, row.bultos),
    })),
  }));

// Empaca los clientes cargados en el formato que usa el informe de contenedores.
const toReportGroups = (clients = []) =>
  clients.map((client) => ({
    name: client.name,
    shipping_mark: client.shipping_mark,
    containers: (client.containers || []).map((row) => ({
      container: row.container,
      bultos: row.bultos,
      description: normalizeContainerDescription(row.description, row.bultos),
    })),
  }));

// Portal público de guías de despacho: solo lectura, sin sesión y sin clave.
// Muestra los contenedores agrupados por cliente y permite imprimir o descargar
// el informe. Quien abre el enlace no puede editar ni seleccionar nada.
export default function PublicDispatchGuides() {
  const [draft, setDraft] = useState('');
  const [applied, setApplied] = useState('');
  const [clients, setClients] = useState([]);
  const [matched, setMatched] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
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
      const incoming = normalizeClients(Array.isArray(data.clients) ? data.clients : []);
      setClients((prev) => (append
        ? [...prev, ...incoming.filter((client) => !prev.some((seen) => seen.key === client.key))]
        : incoming));
      setMatched(Number(data.matched) || 0);
      setHasMore(!!data.has_more);
      nextSkip.current = Number(data.next_skip) || 0;
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'No se pudieron consultar las guías');
      if (!append) {
        setClients([]);
        setMatched(0);
      }
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

  // El informe siempre sale completo: se traen todos los clientes de la consulta.
  const exportReport = async (mode) => {
    setExporting(true);
    setError('');
    try {
      let all = [];
      let skip = 0;
      let more = true;
      while (more) {
        const res = await base44.functions.invoke('publicDispatchGuides', { query: applied, limit: 60, skip });
        const data = res?.data || {};
        if (data?.error) throw new Error(data.error);
        const page = Array.isArray(data.clients) ? data.clients : [];
        all = [...all, ...page];
        more = !!data.has_more && page.length > 0;
        skip = Number(data.next_skip) || skip + page.length;
      }
      await generateContainersReportPdf(toReportGroups(all), 'TLEC CARGO', mode);
    } catch (err) {
      setError(err?.message || 'No se pudo generar el informe');
    } finally {
      setExporting(false);
    }
  };

  const totals = clients.reduce(
    (acc, client) => ({
      containers: acc.containers + (Number(client?.totals?.containers) || 0),
      bultos: acc.bultos + (Number(client?.totals?.bultos) || 0),
    }),
    { containers: 0, bultos: 0 }
  );

  const stats = [
    { label: 'Clientes', value: matched },
    { label: 'Contenedores', value: totals.containers },
    { label: 'Bultos en guías de despacho', value: totals.bultos },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 md:py-8">
        <PublicGuidesHeader />

        <div className="grid gap-2 sm:grid-cols-3">
          {stats.map((stat) => (
            <Card key={stat.label} className="border-border px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{stat.label}</p>
              <p className="text-sm font-bold text-foreground">{stat.value}</p>
            </Card>
          ))}
        </div>

        <Card className="border-border p-3">
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
                placeholder="Cliente, shipping mark, contenedor o guía…"
                aria-label="Buscar por cliente"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={loading} className="flex-1 sm:flex-none">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Buscar
              </Button>
              {applied && (
                <Button type="button" variant="ghost" onClick={clear} disabled={loading}>
                  <X className="h-4 w-4" /> Limpiar
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => exportReport('print')} disabled={exporting || loading}>
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                Imprimir
              </Button>
              <Button type="button" onClick={() => exportReport('save')} disabled={exporting || loading}>
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Descargar PDF
              </Button>
            </div>
          </form>
        </Card>

        {error && (
          <p className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800">{error}</p>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : clients.length === 0 ? (
          <Card className="border-border px-4 py-14 text-center">
            <Boxes className="mx-auto h-9 w-9 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              {applied ? `Ningún cliente coincide con “${applied}”.` : 'Todavía no hay guías de despacho emitidas.'}
            </p>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {clients.map((client) => (
              <PublicClientContainersCard key={client.key} client={client} />
            ))}
            {hasMore && (
              <Button variant="outline" className="w-full" onClick={loadMore} disabled={loadingMore}>
                {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                Cargar más clientes
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