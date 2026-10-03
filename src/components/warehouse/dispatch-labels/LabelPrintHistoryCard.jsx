import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Printer } from 'lucide-react';

const fmtDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Un lote impreso: cuántas etiquetas salieron, su rango X/N, la guía que creó si la hubo
// y quién y cuándo lo imprimió. Desde aquí se reimprime ese mismo lote.
export default function LabelPrintHistoryCard({ log, onReprint, reprinting = false }) {
  const range = log.index_to ? `${log.index_from || 1}/${log.index_to}` : '';
  const when = fmtDateTime(log.printed_date);
  const by = log.printed_by_name || log.printed_by || '';

  return (
    <div className="rounded-xl border border-border/70 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <p className="text-xs font-semibold text-slate-800">
          {log.quantity || 0} etiqueta(s)
        </p>
        {range && (
          <Badge variant="outline" className="border-border/70 bg-muted/60 font-mono text-[10px] text-slate-600">
            X/N {range}
          </Badge>
        )}
        {log.print_type === 'reimpresion' && (
          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-[10px] text-amber-700">
            Reimpresión
          </Badge>
        )}
        {log.without_boxes && (
          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-[10px] text-slate-600">
            Sin cajas
          </Badge>
        )}
        {log.outcome === 'incompleta' && (
          <Badge variant="outline" className="border-rose-200 bg-rose-50 text-[10px] text-rose-700">
            Incompleta
          </Badge>
        )}
        {log.guide_number && (
          <span className="font-mono text-[11px] text-blue-700">{log.guide_number}</span>
        )}
      </div>

      <p className="mt-1 text-[11px] text-slate-500">
        {when}
        {by ? ` · ${by}` : ''}
      </p>

      <Button
        size="sm"
        variant="outline"
        className="mt-2 gap-1.5"
        onClick={() => onReprint?.(log)}
        disabled={reprinting}
      >
        {reprinting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
        Reimprimir
      </Button>
    </div>
  );
}