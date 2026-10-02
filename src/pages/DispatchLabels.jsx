import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Tags } from 'lucide-react';
import ClientSearchBox from '@/components/manual-billing/ClientSearchBox';
import DispatchLabelClientCard from '@/components/warehouse/dispatch-labels/DispatchLabelClientCard';
import BoxQuantityCard from '@/components/warehouse/dispatch-labels/BoxQuantityCard';
import LabelBatchResult from '@/components/warehouse/dispatch-labels/LabelBatchResult';
import useLabelBatch from '@/components/warehouse/dispatch-labels/useLabelBatch';

// Etiquetas de Despacho: se elige el cliente y cuántas cajas van a salir. Se imprime una
// etiqueta por caja con los datos del cliente y el X/N de esa cantidad y, al confirmarse
// la impresión, se crea la guía de despacho con esas cajas.
export default function DispatchLabels() {
  const navigate = useNavigate();
  const batch = useLabelBatch();

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <Tags className="h-6 w-6 text-blue-600" /> Etiquetas de Despacho
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Elige el cliente, escribe cuántas cajas van a salir e imprime su etiqueta. La guía de
          despacho se crea sola al confirmarse la impresión.
        </p>
      </div>

      {!batch.client ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="text-xs text-slate-500">Busca al cliente para imprimir su etiqueta.</p>
            <ClientSearchBox onSelect={batch.selectClient} />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <DispatchLabelClientCard client={batch.client} onChange={batch.clearClient} />

          {batch.loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : (
            <BoxQuantityCard
              quantity={batch.quantity}
              onQuantityChange={batch.setQuantity}
              pendingCount={batch.pendingCount}
              printing={batch.printing}
              progress={batch.progress}
              statusText={batch.statusText}
              onPrint={batch.printBatch}
            />
          )}

          <LabelBatchResult
            guide={batch.result?.guide}
            excluded={batch.result?.excluded || []}
            printedCount={batch.printedCount}
            creating={batch.creating}
            onRetryCreate={batch.retryCreate}
            onOpenGuides={() =>
              navigate('/DispatchGuides', { state: { highlightGuideId: batch.result?.guide?.id || '' } })
            }
          />
        </div>
      )}
    </div>
  );
}