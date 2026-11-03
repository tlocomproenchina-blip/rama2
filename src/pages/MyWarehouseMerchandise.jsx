import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Warehouse, Search, RefreshCw, Loader2, Boxes, FileText } from 'lucide-react';
import { toast } from 'sonner';
import ClientPageHero from '@/components/client-portal/ClientPageHero';
import ClientBultoCard from '@/components/client-portal/ClientBultoCard';
import UnitKindFilter from '@/components/warehouse/UnitKindFilter';
import ClientGuideCard from '@/components/client-portal/ClientGuideCard';
import { ListSkeletonLoader } from '@/components/SkeletonLoaders';

function matches(value, q) {
  return (value || '').toLowerCase().includes(q);
}

export default function MyWarehouseMerchandise({ user }) {
  const [bultos, setBultos] = useState([]);
  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('all');

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const res = await base44.functions.invoke('getMyWarehouseCargo', {});
      const data = res?.data ?? res;
      setBultos(data?.bultos || []);
      setGuides(data?.guides || []);
    } catch (e) {
      if (!silent) toast.error('No se pudo cargar tu carga en almacén');
    } finally {
      if (silent) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Refrescar al volver a la pestaña (la data cambia cuando el almacén escanea o despacha)
    const onVisible = () => { if (!document.hidden) load(true); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  const query = search.trim().toLowerCase();

  const filteredBultos = useMemo(() => {
    const byKind = bultos.filter((b) => kind === 'all' || (kind === 'caja' ? b.is_caja : !b.is_caja));
    if (!query) return byKind;
    return byKind.filter((b) =>
      matches(b.label_code, query) ||
      matches(b.status, query) ||
      (b.order_numbers || []).some((n) => matches(n, query)) ||
      (b.trackings || []).some((t) => matches(t, query)) ||
      (b.unregistered_codes || []).some((t) => matches(t, query)) ||
      (b.packages || []).some((p) => matches(p.tracking, query) || matches(p.description, query))
    );
  }, [bultos, query, kind]);

  const filteredGuides = useMemo(() => {
    if (!query) return guides;
    return guides.filter((g) =>
      matches(g.guide_number, query) ||
      (g.bultos || []).some((b) => matches(b.label_code, query) || matches(b.order_number, query))
    );
  }, [guides, query]);

  const stats = useMemo(() => ({
    bultos: bultos.length,
    cajas: bultos.filter((b) => b.is_caja).length,
    guias: guides.length,
    entregadas: guides.filter((g) => g.dispatch_status === 'entregada').length,
  }), [bultos, guides]);

  if (loading) {
    return (
      <div className="space-y-4 md:space-y-5 lg:space-y-6 w-full">
        <div className="h-8 bg-slate-200 rounded w-40 animate-pulse" />
        <ListSkeletonLoader count={5} />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-5 lg:space-y-6 w-full">
      <ClientPageHero
        icon={Warehouse}
        eyebrow="Carga en almacén"
        title="Mis bultos y guías de despacho"
        description="Consulta tus bultos y cajas consolidadas en almacén y las guías de despacho emitidas a tu nombre."
        badges={[`${stats.bultos} bultos`, `${stats.guias} guías`]}
        action={
          <Button variant="outline" onClick={() => load(true)} disabled={refreshing}>
            {refreshing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Actualizar
          </Button>
        }
        aside={
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Resumen</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-amber-50/80 px-3 py-2">
                <p className="text-[11px] text-amber-600 font-medium">Bultos</p>
                <p className="text-lg font-semibold text-amber-700">{stats.bultos}</p>
              </div>
              <div className="rounded-2xl bg-indigo-50/80 px-3 py-2">
                <p className="text-[11px] text-indigo-600 font-medium">Cajas</p>
                <p className="text-lg font-semibold text-indigo-700">{stats.cajas}</p>
              </div>
              <div className="rounded-2xl bg-blue-50/80 px-3 py-2">
                <p className="text-[11px] text-blue-600 font-medium">Guías</p>
                <p className="text-lg font-semibold text-blue-700">{stats.guias}</p>
              </div>
              <div className="rounded-2xl bg-emerald-50/80 px-3 py-2">
                <p className="text-[11px] text-emerald-600 font-medium">Entregadas</p>
                <p className="text-lg font-semibold text-emerald-700">{stats.entregadas}</p>
              </div>
            </div>
          </div>
        }
      />

      <Card className="border-border/70 bg-card/95 shadow-card">
        <CardContent className="p-3 md:p-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por tracking, descripción, etiqueta, contenedor o N° de guía..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 text-sm"
            />
          </div>
          <div className="mt-3"><UnitKindFilter value={kind} onChange={setKind} /></div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Boxes className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-700">Bultos y cajas consolidadas en almacén</h2>
          <span className="text-xs text-slate-500">({filteredBultos.length})</span>
        </div>
        {filteredBultos.length === 0 ? (
          <Card className="border-border/70 bg-card/95 shadow-card">
            <CardContent className="p-6 text-center">
              <Boxes className="h-10 w-10 mx-auto mb-3 text-slate-300" />
              <p className="text-sm text-slate-500">
                {search ? 'No se encontraron bultos con ese criterio.' : 'Aún no tienes bultos registrados en almacén.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:gap-4">
            {filteredBultos.map((bulto) => <ClientBultoCard key={bulto.id} bulto={bulto} />)}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-700">Guías de despacho</h2>
          <span className="text-xs text-slate-500">({filteredGuides.length})</span>
        </div>
        {filteredGuides.length === 0 ? (
          <Card className="border-border/70 bg-card/95 shadow-card">
            <CardContent className="p-6 text-center">
              <FileText className="h-10 w-10 mx-auto mb-3 text-slate-300" />
              <p className="text-sm text-slate-500">
                {search ? 'No se encontraron guías con ese criterio.' : 'Cuando se emita una guía de despacho con tu carga, la verás aquí.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:gap-4">
            {filteredGuides.map((guide) => <ClientGuideCard key={guide.id} guide={guide} />)}
          </div>
        )}
      </section>
    </div>
  );
}