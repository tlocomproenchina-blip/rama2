import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, ClipboardList, Loader2, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import useDispatchGuides from '@/hooks/useDispatchGuides';
import { summarizeGuide } from '@/lib/dispatchGuides';
import { generateDispatchGuidePdf } from '@/lib/dispatchGuidePdf';
import DispatchGuideFilters from './DispatchGuideFilters';
import DispatchGuideClientCard from './DispatchGuideClientCard';
import DispatchGuideSummary from './DispatchGuideSummary';

// Panel plegable dentro de /WarehouseDispatch: reúne los despachos del rango
// filtrado agrupados por cliente y emite un PDF continuo con la cantidad y el
// código de cada bulto, para verificar la entrega bulto por bulto.
export default function DispatchGuidePanel() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState([]);
  const [generating, setGenerating] = useState('');
  const [appName, setAppName] = useState('TLEC CARGO');

  const { clients, loading, loadingMore, hasMore, offline, error, filters, setFilters, refresh, loadMore, fetchGuideForClients } =
    useDispatchGuides({ enabled: open });

  useEffect(() => {
    if (!open) return;
    base44.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1)
      .then((rows) => {
        if (rows?.[0]?.app_name) setAppName(rows[0].app_name);
      })
      .catch(() => {});
  }, [open]);

  // La selección se mantiene solo con los clientes que siguen en pantalla
  useEffect(() => {
    setSelected((prev) => prev.filter((email) => clients.some((c) => c.client_email === email)));
  }, [clients]);

  const summary = useMemo(() => summarizeGuide(clients, selected), [clients, selected]);
  const selectedClients = useMemo(
    () => clients.filter((c) => selected.includes(c.client_email)),
    [clients, selected]
  );

  const toggleClient = (email) =>
    setSelected((prev) => (prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]));

  const handleGenerate = async (mode) => {
    if (!selectedClients.length) {
      toast.error('Marca al menos un cliente');
      return;
    }
    setGenerating(mode);
    try {
      // La guía se emite con los despachos completos de los clientes marcados,
      // no solo con la página visible en pantalla.
      let guideClients = selectedClients;
      try {
        const complete = await fetchGuideForClients(selected);
        if (complete.length) guideClients = complete;
      } catch (_) {}
      await generateDispatchGuidePdf({ clients: guideClients, appName, mode, offline });
      toast.success(mode === 'print' ? 'Guía lista para imprimir' : 'Guía de despacho descargada');
    } catch (e) {
      toast.error('No se pudo generar la guía de despacho');
    }
    setGenerating('');
  };

  return (
    <Card>
      <CardContent className="p-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 p-4 text-left"
        >
          <div className="flex min-w-0 items-center gap-3">
            <ClipboardList className="h-5 w-5 shrink-0 text-blue-600" />
            <div className="min-w-0">
              <p className="font-semibold text-slate-800">Guías de despacho</p>
              <p className="text-xs text-slate-500">
                Reúne los despachos de cada cliente con la cantidad y el código de cada bulto para verificar la entrega.
              </p>
            </div>
          </div>
          {open ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
          )}
        </button>

        {open && (
          <div className="space-y-4 border-t p-4">
            <DispatchGuideFilters filters={filters} onChange={setFilters} onRefresh={refresh} loading={loading} />

            {(offline || error) && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800">
                <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error || 'Sin conexión: guía armada con los despachos guardados en el dispositivo.'}</span>
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : clients.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No hay despachos en el rango elegido.</p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
                <div className="space-y-3">
                  {clients.map((client) => (
                    <DispatchGuideClientCard
                      key={client.client_email || client.client_name}
                      client={client}
                      selected={selected.includes(client.client_email)}
                      onToggle={() => toggleClient(client.client_email)}
                    />
                  ))}
                  {hasMore && (
                    <Button variant="outline" className="w-full" onClick={loadMore} disabled={loadingMore}>
                      {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                      Cargar más despachos
                    </Button>
                  )}
                </div>
                <DispatchGuideSummary
                  summary={summary}
                  selectedClients={selectedClients}
                  generating={generating}
                  onGenerate={handleGenerate}
                />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}