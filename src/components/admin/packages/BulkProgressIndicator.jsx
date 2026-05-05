import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Info } from 'lucide-react';

export default function BulkProgressIndicator({ progress }) {
  if (!progress) return null;
  const done = progress.total - progress.remaining;
  const pct = progress.total > 0 ? Math.round((done / progress.total) * 100) : 0;
  const hasBatches = Number.isFinite(progress.currentBatch) && Number.isFinite(progress.totalBatches);

  return (
    <Card className="border-2 border-amber-300 shadow-xl bg-gradient-to-br from-amber-50 to-amber-100">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-4">
          <Loader2 className="h-6 w-6 animate-spin text-amber-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-900">
              {progress.label || 'Procesando paquetes'}
            </p>
            {hasBatches && (
              <p className="text-xs text-amber-700 mt-0.5">
                Lote {progress.currentBatch} de {progress.totalBatches} · grupos de {progress.batchSize || 10}
              </p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-2xl font-bold text-amber-700 tabular-nums leading-none">
              {done}<span className="text-amber-500 text-base">/{progress.total}</span>
            </div>
            <div className="text-xs text-amber-600 font-semibold">{pct}%</div>
          </div>
        </div>

        <div className="h-2.5 w-full bg-amber-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-100/60 rounded-lg px-3 py-2 border border-amber-200">
          <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <p>
            <span className="font-semibold">No recargues la página.</span> Las operaciones se procesan en lotes para evitar errores. Espera a que termine.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}