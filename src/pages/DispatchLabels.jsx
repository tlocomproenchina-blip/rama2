import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Tags } from 'lucide-react';
import ClientSearchBox from '@/components/manual-billing/ClientSearchBox';
import DispatchLabelClientCard from '@/components/warehouse/dispatch-labels/DispatchLabelClientCard';
import UnitBatchList from '@/components/warehouse/dispatch-labels/UnitBatchList';
import LabelBatchSummary from '@/components/warehouse/dispatch-labels/LabelBatchSummary';
import LabelBatchResult from '@/components/warehouse/dispatch-labels/LabelBatchResult';
import useLabelBatch from '@/components/warehouse/dispatch-labels/useLabelBatch';

// Etiquetas de Despacho: se marcan las unidades del cliente (cajas consolidadas y
// bultos sueltos) que van a salir, se escribe el X/N de cada etiqueta, se imprime la
// tira continua y, al confirmarse la impresión, nace la guía de despacho con esas
// unidades. Si la impresión falla, no se crea guía.
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
          Marca las cajas y bultos que van a salir, escribe el X/N de cada etiqueta, imprime su tira
          continua y la guía de despacho se crea sola con esas unidades.
        </p>
      </div>

      {!batch.client ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="text-xs text-slate-500">
              Busca al cliente para ver todas sus cajas y bultos por despachar.
            </p>
            <ClientSearchBox onSelect={batch.selectClient} />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <DispatchLabelClientCard client={batch.client} onChange={batch.clearClient} />

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

          {batch.loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : (
            <Card>
              <CardContent className="space-y-3 p-4">
                <UnitBatchList
                  units={batch.units}
                  selected={batch.selected}
                  labels={batch.labels}
                  onToggle={batch.toggleUnit}
                  onToggleAll={batch.toggleAll}
                  onNumberChange={batch.setLabelNumber}
                  disabled={batch.printing || batch.creating}
                />
                <LabelBatchSummary
                  count={batch.selectedUnits.length}
                  packages={batch.totals.packages}
                  cbm={batch.totals.cbm}
                  missing={batch.missing}
                  printing={batch.printing}
                  progress={batch.progress}
                  statusText={batch.statusText}
                  onPrint={batch.printBatch}
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}