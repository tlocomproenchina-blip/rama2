import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Download, Loader2, Printer } from 'lucide-react';

const fmtDay = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value || '');
};

const MAX_CHIPS = 24;

// Resultado de la generación: cuántas guías quedaron listas para imprimir y las
// acciones para sacar el PDF conjunto.
export default function PeriodGuidesSummary({ result, onPdf, printing }) {
  if (!result) return null;

  if (result.empty) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800">
        {result.no_units
          ? `Hay ${result.invoices || 0} factura(s) pagada(s) en el período, pero todavía no tienen bultos ni cajas vinculados.`
          : 'No hay facturas pagadas en ese período. Elige otras fechas.'}
      </p>
    );
  }

  const guides = Array.isArray(result.guides) ? result.guides : [];
  const totals = result.totals || {};
  const numbers = guides.map((guide) => guide.guide_number).filter(Boolean);
  const shown = numbers.slice(0, MAX_CHIPS);
  const rest = numbers.length - shown.length;

  return (
    <div className="space-y-3 rounded-xl border border-primary/25 bg-accent/30 p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
        <Badge variant="outline" className="border-primary/30 bg-white text-primary">
          {guides.length} guía(s) del período
        </Badge>
        <span>{result.created || 0} nueva(s)</span>
        <span>·</span>
        <span>{result.existing || 0} ya en el historial</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
        <span>Período: {fmtDay(result.from)} al {fmtDay(result.to)}</span>
        <span>·</span>
        <span>{totals.clients || 0} cliente(s)</span>
        <span>·</span>
        <span>{totals.bultos || 0} bulto(s) ({totals.cajas || 0} caja(s))</span>
        <span>·</span>
        <span>{totals.packages || 0} paquete(s)</span>
      </div>

      {numbers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {shown.map((number) => (
            <span key={number} className="rounded-lg border border-border/70 bg-white px-2 py-0.5 font-mono text-[11px] text-slate-700">
              {number}
            </span>
          ))}
          {rest > 0 && <span className="px-1 py-0.5 text-[11px] text-slate-500">+{rest} más</span>}
        </div>
      )}

      {Array.isArray(result.failed) && result.failed.length > 0 && (
        <p className="flex items-start gap-1.5 rounded-xl border border-amber-200 bg-amber-50/70 p-2 text-[11px] text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          No se pudo numerar la guía de {result.failed.length} cliente(s): {result.failed.slice(0, 3).join(', ')}
          {result.failed.length > 3 ? '…' : ''}. Vuelve a generar el período para completarlas.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onPdf('print')} disabled={Boolean(printing) || !numbers.length}>
          {printing === 'print' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
          Imprimir todas en 1 PDF
        </Button>
        <Button size="sm" variant="outline" onClick={() => onPdf('save')} disabled={Boolean(printing) || !numbers.length}>
          {printing === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Descargar PDF
        </Button>
      </div>
    </div>
  );
}