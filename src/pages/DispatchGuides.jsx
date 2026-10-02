import React, { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { base44 } from '@/components/api/ApiQueueManager';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, Clock3 } from 'lucide-react';
import DispatchGuideHistoryPanel from '@/components/warehouse/dispatch-guides/DispatchGuideHistoryPanel';
import DispatchGuideSyncCard from '@/components/warehouse/dispatch-guides/DispatchGuideSyncCard';

// Guías de despacho: las guías nacen al imprimir el lote de etiquetas (módulo Etiquetas
// de Despacho), así que esta pantalla queda para consultar el historial, reimprimir o
// descargar la guía, anotar su entrega y sincronizar los escaneos que llegaron sin guía.
export default function DispatchGuides() {
  const location = useLocation();
  const [highlightId] = useState(location.state?.highlightGuideId || '');
  const [pendingCount, setPendingCount] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

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

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
            <ClipboardList className="h-6 w-6 text-blue-600" /> Guías de Despacho
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Consulta las guías emitidas, reimprime o descarga su PDF y anota la entrega. Las guías
            se crean al imprimir el lote de etiquetas en Etiquetas de Despacho.
          </p>
        </div>
        {pendingCount > 0 && (
          <Badge variant="outline" className="gap-1.5 border-amber-200 bg-amber-50 text-amber-700">
            <Clock3 className="h-3.5 w-3.5" /> {pendingCount} guía(s) pendiente(s) de entrega
          </Badge>
        )}
      </div>

      <DispatchGuideSyncCard
        reloadSignal={reloadKey}
        onSynced={() => setReloadKey((key) => key + 1)}
      />

      <DispatchGuideHistoryPanel highlightId={highlightId} onGuideUpdated={loadPendingCount} />
    </div>
  );
}