import React from 'react';
import { Button } from '@/components/ui/button';
import { ClipboardList, Eraser, Loader2 } from 'lucide-react';

// Resumen de lo que se va a emitir y el botón que confirma la guía.
export default function ManualGuideSelectionSummary({ summary, emitting, onEmit, onClear }) {
  const empty = !summary.bultos;

  return (
    <div className="rounded-xl border border-border/70 bg-accent/40 p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-700">
        <span className="font-semibold">{summary.clients} cliente(s)</span>
        <span>·</span>
        <span>{summary.bultos} bulto(s)</span>
        <span>·</span>
        <span>{summary.packages} paquete(s)</span>
        {summary.cbm > 0 && (
          <>
            <span>·</span>
            <span>{summary.cbm.toFixed(3)} CBM</span>
          </>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button onClick={onEmit} disabled={empty || emitting} className="gap-2 sm:w-auto">
          {emitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
          {emitting ? 'Emitiendo guía…' : 'Emitir guía y orden'}
        </Button>
        <Button variant="ghost" onClick={onClear} disabled={empty || emitting} className="gap-2 sm:w-auto">
          <Eraser className="h-4 w-4" />
          Limpiar selección
        </Button>
      </div>

      <p className="mt-2 text-[11px] text-slate-500">
        Al emitir se guarda la guía con su número correlativo y se genera sola la orden de despacho de cada
        cliente con sus bultos.
      </p>
    </div>
  );
}