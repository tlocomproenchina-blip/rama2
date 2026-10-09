import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, PenSquare } from 'lucide-react';
import { toast } from 'sonner';
import { generateDispatchGuidePdf } from '@/lib/dispatchGuidePdf';
import useManualGuideCandidates from '@/hooks/useManualGuideCandidates';
import ManualGuideClientCard from './ManualGuideClientCard';
import ManualGuideSelectionSummary from './ManualGuideSelectionSummary';

// Emisión manual de una guía: se eligen a mano el cliente y los bultos escaneados
// que siguen pendientes de guía. Al emitir, la guía queda con su número correlativo
// y se genera sola la orden de despacho de cada cliente (el mismo camino del flujo
// actual), más el PDF de la guía para imprimir.
export default function ManualGuideCard({ onGenerated }) {
  const { search, setSearch, clients, loading, loadingMore, hasMore, loadMore, reload } = useManualGuideCandidates();
  const [selected, setSelected] = useState(() => new Set());
  const [emitting, setEmitting] = useState(false);
  const [appName, setAppName] = useState('TLEC CARGO');

  useEffect(() => {
    base44.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1)
      .then((rows) => {
        if (rows?.[0]?.app_name) setAppName(rows[0].app_name);
      })
      .catch(() => {});
  }, []);

  const summary = useMemo(() => {
    const keys = new Set();
    let bultos = 0;
    let packages = 0;
    let cbm = 0;
    clients.forEach((client) => {
      (client.bultos || []).forEach((bulto) => {
        if (!selected.has(bulto.label_code)) return;
        bultos += 1;
        packages += Number(bulto.package_count) || 0;
        cbm += Number(bulto.cbm) || 0;
        keys.add(client.client_key || client.client_email || client.client_name);
      });
    });
    return { clients: keys.size, bultos, packages, cbm };
  }, [clients, selected]);

  const toggleBulto = (code) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleClient = (client) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const codes = (client.bultos || []).map((bulto) => bulto.label_code).filter(Boolean);
      const allSelected = codes.length > 0 && codes.every((code) => next.has(code));
      codes.forEach((code) => (allSelected ? next.delete(code) : next.add(code)));
      return next;
    });
  };

  const emit = async () => {
    if (!selected.size) {
      toast.error('Marca al menos un bulto para emitir la guía');
      return;
    }

    setEmitting(true);
    try {
      const res = await base44.functions.invoke('createDispatchGuide', {
        codes: [...selected],
        with_orders: true,
      });
      const data = res?.data || res || {};
      if (data.error) throw new Error(data.error);

      const guide = data.guide || {};
      const orders = data.orders || [];
      setSelected(new Set());

      toast.success(
        `Guía ${guide.guide_number || ''} emitida · ${orders.length} orden(es) de despacho generada(s)`
      );
      if (data.orders_failed?.length) {
        toast.warning(
          `${data.orders_failed.length} cliente(s) sin orden automática: ${data.orders_failed
            .map((item) => item.client)
            .join(', ')}`
        );
      }

      if (guide.clients?.length) {
        await generateDispatchGuidePdf({
          clients: guide.clients,
          appName,
          mode: 'save',
          guideNumber: guide.guide_number,
          emittedAt: guide.emitted_date,
        });
      }

      reload();
      onGenerated?.();
    } catch (error) {
      toast.error(error?.message || 'No se pudo emitir la guía');
    }
    setEmitting(false);
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-2xl bg-primary/10 p-2 text-primary">
            <PenSquare className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-semibold text-foreground">Emisión manual de guía</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Elige a mano el cliente y los bultos escaneados que siguen pendientes. Al emitir se guarda la guía
              numerada y se genera sola la orden de despacho de cada cliente.
            </p>
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por cliente, mark, código de bulto o tracking"
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : clients.length === 0 ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            No hay bultos pendientes de guía con esa búsqueda. Los bultos que ya entraron en una guía no vuelven a
            ofrecerse.
          </p>
        ) : (
          <div className="space-y-2">
            {clients.map((client) => (
              <ManualGuideClientCard
                key={client.client_key || client.client_email || client.client_name}
                client={client}
                selectedCodes={selected}
                onToggleBulto={toggleBulto}
                onToggleClient={toggleClient}
              />
            ))}
            {hasMore && (
              <Button variant="outline" onClick={loadMore} disabled={loadingMore} className="w-full gap-2">
                {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loadingMore ? 'Cargando más…' : 'Cargar más pendientes'}
              </Button>
            )}
          </div>
        )}

        <ManualGuideSelectionSummary
          summary={summary}
          emitting={emitting}
          onEmit={emit}
          onClear={() => setSelected(new Set())}
        />
      </CardContent>
    </Card>
  );
}