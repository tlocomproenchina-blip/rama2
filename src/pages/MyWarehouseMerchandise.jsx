import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Warehouse, Search, RefreshCw, Loader2, Package, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { groupItemsByReceipt } from '@/lib/dispatchOrderGroups';
import ClientPageHero from '@/components/client-portal/ClientPageHero';
import { ListSkeletonLoader } from '@/components/SkeletonLoaders';

const STATUS_LABELS = {
  emitida: 'En almacén',
  despachado: 'Despachada',
};

const STATUS_TONE = {
  emitida: 'bg-amber-100 text-amber-700 border-amber-200',
  despachado: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

export default function MyWarehouseMerchandise({ user }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const res = await base44.functions.invoke('getMyDispatchOrders', {});
      const data = res?.data ?? res;
      setOrders(data?.orders || []);
    } catch (e) {
      if (!silent) toast.error('No se pudo cargar tu mercancía en almacén');
    } finally {
      if (silent) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Refrescar al volver a la pestaña (la data cambia cuando el admin crea despachos)
    const onVisible = () => { if (!document.hidden) load(true); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) => {
      if ((o.order_number || '').toLowerCase().includes(q)) return true;
      if ((o.notes || '').toLowerCase().includes(q)) return true;
      return (o.items || []).some((it) =>
        (it.tracking_number || '').toLowerCase().includes(q) ||
        (it.consolidation_tracking || '').toLowerCase().includes(q) ||
        (it.description || '').toLowerCase().includes(q)
      );
    });
  }, [orders, search]);

  const stats = useMemo(() => ({
    total: orders.length,
    enAlmacen: orders.filter((o) => o.status === 'emitida').length,
    despachadas: orders.filter((o) => o.status === 'despachado').length,
    trackings: orders.reduce((acc, o) => acc + (o.items?.length || 0), 0),
  }), [orders]);

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
        eyebrow="Mercancía agrupada por recibo"
        title="Mercancía en Almacén"
        description="Consulta tu mercancía agrupada por orden de despacho y recibo, con su estado actual."
        badges={[`${stats.total} órdenes`, `${stats.trackings} trackings`]}
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
                <p className="text-[11px] text-amber-600 font-medium">En almacén</p>
                <p className="text-lg font-semibold text-amber-700">{stats.enAlmacen}</p>
              </div>
              <div className="rounded-2xl bg-emerald-50/80 px-3 py-2">
                <p className="text-[11px] text-emerald-600 font-medium">Despachadas</p>
                <p className="text-lg font-semibold text-emerald-700">{stats.despachadas}</p>
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
              placeholder="Buscar por orden, tracking o recibo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card className="border-border/70 bg-card/95 shadow-card">
          <CardContent className="p-6 md:p-12 text-center">
            <Warehouse className="h-12 md:h-16 w-12 md:w-16 mx-auto mb-3 md:mb-4 text-slate-300" />
            <h3 className="text-base md:text-lg font-semibold text-slate-700 mb-2">
              {search ? 'No se encontraron resultados' : 'No tienes mercancía en almacén aún'}
            </h3>
            <p className="text-xs md:text-sm text-slate-500">
              {search
                ? 'Prueba con otro término de búsqueda.'
                : 'Cuando el almacén genere una orden de despacho con tus paquetes, la verás aquí agrupada por recibo.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:gap-4">
          {filtered.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order }) {
  const groups = useMemo(() => groupItemsByReceipt(order.items || []), [order.items]);
  const date = order.dispatched_confirmed_date || order.dispatched_date || order.created_date;
  const isDispatched = order.status === 'despachado';

  return (
    <Card className="border border-border/70 bg-card/95 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-premium">
      <CardContent className="p-3 md:p-4 lg:p-5">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 mb-3">
          <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
            <div className="p-2 bg-slate-100 rounded-lg flex-shrink-0">
              <Package className="h-4 w-4 md:h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-800 text-sm md:text-base truncate">
                Orden {order.order_number || '—'}
              </h3>
              <p className="text-[11px] md:text-xs text-slate-500">
                {date ? new Date(date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Sin fecha'}
                {isDispatched && order.dispatched_confirmed_date && (
                  <span className="text-emerald-600 ml-1">· Despachada</span>
                )}
              </p>
            </div>
          </div>
          <Badge className={`${STATUS_TONE[order.status] || 'bg-slate-100 text-slate-600 border-slate-200'} border`}>
            {STATUS_LABELS[order.status] || order.status}
          </Badge>
        </div>

        {/* Recibos agrupados */}
        <div className="space-y-2">
          {groups.map((g) => (
            <div key={g.receipt} className="rounded-xl border border-border/60 bg-slate-50/60 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-white/70 border-b border-border/50">
                <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-700 truncate">
                  {g.receipt === 'Sin recibo' ? 'Sin recibo asignado' : `Recibo: ${g.receipt}`}
                </span>
                <Badge variant="secondary" className="ml-auto text-[10px] py-0 px-1.5">
                  {g.count} {g.count === 1 ? 'paquete' : 'paquetes'}
                </Badge>
              </div>
              <div className="p-2 space-y-1">
                {g.items.map((it, idx) => (
                  <div key={idx} className="flex items-start gap-2 px-1 py-1">
                    <span className="text-slate-300 text-xs mt-0.5">•</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs text-slate-800 break-all">{it.tracking_number || '—'}</p>
                      {it.description && (
                        <p className="text-[11px] text-slate-500 line-clamp-1">{it.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {order.notes && (
          <p className="text-[11px] md:text-xs text-slate-500 mt-3 pt-2 border-t border-border/40">
            <span className="font-medium">Notas: </span>{order.notes}
          </p>
        )}
      </CardContent>
    </Card>
  );
}