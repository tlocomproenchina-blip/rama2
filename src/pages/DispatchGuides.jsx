import React, { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { base44 } from '@/components/api/ApiQueueManager';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClipboardList, Clock3 } from 'lucide-react';
import DispatchGuideHistoryPanel from '@/components/warehouse/dispatch-guides/DispatchGuideHistoryPanel';
import DispatchGuideSyncCard from '@/components/warehouse/dispatch-guides/DispatchGuideSyncCard';
import PeriodGuidesCard from '@/components/warehouse/dispatch-guides/PeriodGuidesCard';
import ManualGuideCard from '@/components/warehouse/dispatch-guides/ManualGuideCard';
import PublicGuidesLinkCard from '@/components/warehouse/dispatch-guides/PublicGuidesLinkCard';
import DispatchOrdersPanel from '@/components/dispatch-order/DispatchOrdersPanel';
import ContainerSearchPanel from '@/components/warehouse/containers/ContainerSearchPanel';

// Guías de despacho: aquí se generan las guías de un período pagado (una por cliente,
// todas en un solo PDF) y se consulta el historial para reimprimir, descargar o anotar
// la entrega, además de sincronizar los escaneos que llegaron sin guía. Las guías del
// lote de etiquetas y las del escáner de despacho también caen en este mismo historial.
// La Orden de Despacho para el almacén vive aquí mismo, en su propia pestaña.
const TAB_HEADERS = {
  guias: {
    title: 'Guías de Despacho',
    description: 'Genera las guías de un período pagado o elige a mano el cliente y sus bultos, y consulta las guías emitidas para reimprimir, descargar o anotar la entrega.',
  },
  ordenes: {
    title: 'Orden de Despacho',
    description: 'Elige el período: se agrupan todas las facturas pagadas en esos días y se arma la orden con los clientes por ciudad, el N° de contenedor pagado y cuántas cajas y bultos le corresponden a cada uno.',
  },
};

export default function DispatchGuides() {
  const location = useLocation();
  const [highlightId] = useState(location.state?.highlightGuideId || '');
  const [tab, setTab] = useState('guias');
  const [pendingCount, setPendingCount] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [historyKey, setHistoryKey] = useState(0);

  const loadPendingCount = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('listDispatchGuides', { count_only: true });
      const data = res?.data || res || {};
      if (typeof data.pending_delivery_count === 'number') setPendingCount(data.pending_delivery_count);
    } catch (_) {}
  }, []);

  useEffect(() => {
    loadPendingCount();
  }, [loadPendingCount]);

  // Al generar las guías del período, el historial se refresca para mostrarlas ya emitidas.
  const handleGuidesGenerated = useCallback(() => {
    setHistoryKey((key) => key + 1);
    loadPendingCount();
  }, [loadPendingCount]);

  const header = TAB_HEADERS[tab] || TAB_HEADERS.guias;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
            <ClipboardList className="h-6 w-6 text-blue-600" /> {header.title}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{header.description}</p>
        </div>
        {tab === 'guias' && pendingCount > 0 && (
          <Badge variant="outline" className="gap-1.5 border-amber-200 bg-amber-50 text-amber-700">
            <Clock3 className="h-3.5 w-3.5" /> {pendingCount} guía(s) pendiente(s) de entrega
          </Badge>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-5">
        <TabsList className="grid w-full grid-cols-2 sm:max-w-md">
          <TabsTrigger value="guias">Guías de Despacho</TabsTrigger>
          <TabsTrigger value="ordenes">Órdenes despacho</TabsTrigger>
        </TabsList>

        <ContainerSearchPanel />

        <TabsContent value="guias" className="space-y-5">
          <PublicGuidesLinkCard />

          <PeriodGuidesCard onGenerated={handleGuidesGenerated} />

          <ManualGuideCard onGenerated={handleGuidesGenerated} />

          <DispatchGuideSyncCard
            reloadSignal={reloadKey}
            onSynced={() => setReloadKey((key) => key + 1)}
          />

          <DispatchGuideHistoryPanel
            highlightId={highlightId}
            reloadSignal={historyKey}
            onGuideUpdated={loadPendingCount}
          />
        </TabsContent>

        <TabsContent value="ordenes" className="space-y-5">
          <DispatchOrdersPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}