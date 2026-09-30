import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import useDispatchGuides from '@/hooks/useDispatchGuides';
import { summarizeGuide } from '@/lib/dispatchGuides';
import { generateDispatchGuidePdf } from '@/lib/dispatchGuidePdf';
import DispatchGuideFilters from './DispatchGuideFilters';
import DispatchGuideClientCard from './DispatchGuideClientCard';
import DispatchGuideSummary from './DispatchGuideSummary';

const startOfDayISO = (date) => (date ? `${date}T00:00:00.000Z` : '');
const endOfDayISO = (date) => (date ? `${date}T23:59:59.999Z` : '');

// Emisión de la guía de despacho: reúne los bultos escaneados para despacho que
// todavía no pertenecen a una guía emitida, agrupados por cliente. Al generar,
// el backend asigna el número, guarda el snapshot y saca esos bultos de la lista
// de pendientes.
export default function DispatchGuideEmitPanel({ onEmitted }) {
  const [selected, setSelected] = useState([]);
  const [generating, setGenerating] = useState('');
  const [appName, setAppName] = useState('TLEC CARGO');

  const { clients, loading, loadingMore, hasMore, offline, error, filters, setFilters, refresh, loadMore } =
    useDispatchGuides({ enabled: true });

  useEffect(() => {
    base44.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1)
      .then((rows) => {
        if (rows?.[0]?.app_name) setAppName(rows[0].app_name);
      })
      .catch(() => {});
  }, []);

  // La selección se mantiene solo con los clientes que siguen en pantalla
  useEffect(() => {
    setSelected((prev) => prev.filter((key) => clients.some((c) => c.client_key === key)));
  }, [clients]);

  const summary = useMemo(() => summarizeGuide(clients, selected), [clients, selected]);
  const selectedClients = useMemo(
    () => clients.filter((c) => selected.includes(c.client_key)),
    [clients, selected]
  );

  const toggleClient = (key) =>
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const handleGenerate = async (mode) => {
    if (!selectedClients.length) {
      toast.error('Marca al menos un cliente');
      return;
    }
    if (offline) {
      toast.error('Sin conexión no se pueden emitir guías nuevas');
      return;
    }

    setGenerating(mode);
    try {
      const res = await base44.functions.invoke('createDispatchGuide', {
        client_emails: selectedClients.map((c) => c.client_email).filter(Boolean),
        codes: selectedClients
          .filter((c) => !c.client_email)
          .flatMap((c) => (c.bultos || []).map((b) => b.label_code))
          .filter(Boolean),
        from: startOfDayISO(filters.from),
        to: endOfDayISO(filters.to),
      });

      const data = res?.data || res || {};
      const guide = data.guide;
      if (!guide) throw new Error(data.error || 'No se pudo emitir la guía de despacho');

      const skipped = Array.isArray(data.skipped) ? data.skipped : [];
      if (skipped.length) {
        toast.warning(`${skipped.length} código(s) ya estaban en otra guía y no se incluyeron`);
      }

      // El PDF se emite con el snapshot guardado, con el número de guía asignado.
      await generateDispatchGuidePdf({
        clients: guide.clients || [],
        appName,
        mode,
        guideNumber: guide.guide_number,
        emittedAt: guide.emitted_date,
      });

      setSelected([]);
      refresh();
      onEmitted?.(guide);
      toast.success(`Guía ${guide.guide_number} emitida · ${guide.totals?.bultos || 0} bulto(s)`);
    } catch (e) {
      const message =
        e?.response?.data?.error || e?.message || 'No se pudo generar la guía de despacho';
      toast.error(message);
    }
    setGenerating('');
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <p className="text-xs text-slate-500">
          Solo aparecen los bultos escaneados para despacho que todavía no forman parte de una guía.
          Al emitir la guía, sus bultos salen de esta lista y quedan en el historial.
        </p>

        <DispatchGuideFilters filters={filters} onChange={setFilters} onRefresh={refresh} loading={loading} />

        {(offline || error) && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800">
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error || 'Sin conexión: guía armada con los escaneos guardados en el dispositivo.'}</span>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : clients.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            No hay bultos escaneados pendientes de guía en el rango elegido.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <div className="space-y-3">
              {clients.map((client) => (
                <DispatchGuideClientCard
                  key={client.client_key}
                  client={client}
                  selected={selected.includes(client.client_key)}
                  onToggle={() => toggleClient(client.client_key)}
                />
              ))}
              {hasMore && (
                <Button variant="outline" className="w-full" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                  Cargar más escaneos
                </Button>
              )}
            </div>
            <DispatchGuideSummary
              summary={summary}
              selectedClients={selectedClients}
              generating={generating}
              onGenerate={handleGenerate}
              disabled={offline}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}