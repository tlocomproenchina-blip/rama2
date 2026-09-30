import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, Clock3, History } from 'lucide-react';
import DispatchGuideEmitPanel from '@/components/warehouse/dispatch-guides/DispatchGuideEmitPanel';
import DispatchGuideEmittedNotice from '@/components/warehouse/dispatch-guides/DispatchGuideEmittedNotice';
import DispatchGuideHistoryPanel from '@/components/warehouse/dispatch-guides/DispatchGuideHistoryPanel';

// Módulo de guías de despacho: emisión desde los bultos escaneados pendientes e
// historial de guías emitidas, con reimpresión y anotación de entrega.
export default function DispatchGuides() {
  const [tab, setTab] = useState('emitir');
  const [emittedGuide, setEmittedGuide] = useState(null);
  const [highlightId, setHighlightId] = useState('');
  const [historyKey, setHistoryKey] = useState(0);
  const [pendingCount, setPendingCount] = useState(null);

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

  const handleEmitted = (guide) => {
    setEmittedGuide(guide);
    setHighlightId(guide?.id || '');
    setHistoryKey((key) => key + 1);
    setTab('historial');
    loadPendingCount();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
            <ClipboardList className="h-6 w-6 text-blue-600" /> Guías de Despacho
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Emite la guía con los bultos escaneados para despacho y consulta el historial de guías
            emitidas para reimprimir o anotar su entrega.
          </p>
        </div>
        {pendingCount > 0 && (
          <Badge variant="outline" className="gap-1.5 border-amber-200 bg-amber-50 text-amber-700">
            <Clock3 className="h-3.5 w-3.5" /> {pendingCount} guía(s) pendiente(s) de entrega
          </Badge>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2 sm:inline-grid sm:w-auto">
          <TabsTrigger value="emitir" className="gap-1.5">
            <ClipboardList className="h-4 w-4" /> Emitir guía
          </TabsTrigger>
          <TabsTrigger value="historial" className="gap-1.5">
            <History className="h-4 w-4" /> Historial
          </TabsTrigger>
        </TabsList>

        <TabsContent value="emitir" className="mt-4">
          <DispatchGuideEmitPanel onEmitted={handleEmitted} />
        </TabsContent>

        <TabsContent value="historial" className="mt-4 space-y-4">
          <DispatchGuideEmittedNotice
            guide={emittedGuide}
            onClose={() => setEmittedGuide(null)}
            onOpen={() => setHighlightId(emittedGuide?.id || '')}
          />
          <DispatchGuideHistoryPanel
            key={historyKey}
            highlightId={highlightId}
            onGuideUpdated={loadPendingCount}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}