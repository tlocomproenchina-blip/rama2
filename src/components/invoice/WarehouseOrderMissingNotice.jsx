import React from 'react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Aviso en la fila de una factura pagada que quedó sin orden de almacén (las que se
// pagaron antes de que la orden se armara sola en todas las vías de pago, o las que
// todavía no tenían bultos vinculados al pagarse). Genera la orden con un toque, sin
// salir del listado.
export default function WarehouseOrderMissingNotice({ working, onGenerate }) {
  return (
    <div className="rounded-xl border border-amber-400/60 bg-amber-400/15 px-3 py-2 space-y-2">
      <p className="flex items-start gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-200">
        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        Pagada sin orden de almacén
      </p>
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-center border-amber-400/60 text-amber-800 hover:bg-amber-400/20 dark:text-amber-200"
        onClick={onGenerate}
        disabled={working}
      >
        {working ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
        Generar
      </Button>
    </div>
  );
}