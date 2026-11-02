import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, X } from 'lucide-react';

// Resultado real de una acción masiva: cuántos se aplicaron y cuáles quedaron
// pendientes, con sus trackings, para poder reintentar sólo esos.
export default function BulkResultPanel({ result, processing, onRetry, onDismiss }) {
  if (!result || !result.failed?.length) return null;
  const shown = result.failed.slice(0, 8);
  const rest = result.failed.length - shown.length;

  return (
    <Card className="border-2 border-amber-300 bg-amber-50">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-900">
              {result.okCount} de {result.total} paquetes procesados
            </p>
            <p className="text-xs text-amber-800 mt-1">
              {result.failed.length} no se pudieron actualizar. Ya se reintentaron una vez de forma automática.
            </p>
            <ul className="mt-2 space-y-1">
              {shown.map((f) => (
                <li key={f.id} className="text-xs text-amber-900 font-mono break-all">
                  {f.tracking_number || f.id}
                  {f.error ? <span className="font-sans text-amber-700"> — {f.error}</span> : null}
                </li>
              ))}
              {rest > 0 && (
                <li className="text-xs text-amber-700">y {rest} más…</li>
              )}
            </ul>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-amber-700 hover:bg-amber-100 flex-shrink-0"
            onClick={onDismiss}
            aria-label="Cerrar resultado"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={onRetry} disabled={processing} className="bg-amber-600 hover:bg-amber-700 gap-2">
            <RefreshCw className={`h-4 w-4 ${processing ? 'animate-spin' : ''}`} />
            Reintentar los {result.failed.length} pendientes
          </Button>
          <Button variant="outline" onClick={onDismiss} disabled={processing}>
            Cerrar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}