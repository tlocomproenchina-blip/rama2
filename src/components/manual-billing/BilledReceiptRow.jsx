import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Package } from 'lucide-react';

const fmtDate = (v) => {
  if (!v) return null;
  const d = new Date(String(v).includes('T') ? v : `${v}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('es-VE');
};

// Un envío ya facturado por fuera: se conserva con su CBM y trackings, marcado en
// verde, y la misma casilla lo devuelve a la lista facturable.
export default function BilledReceiptRow({ receipt, marking, onUnmark }) {
  return (
    <div className="rounded-lg border border-emerald-300 bg-emerald-50/60 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold text-emerald-800 break-all">
            {receipt.order || 'Sin N° de contenedor'}
          </p>
          <p className="text-[11px] text-slate-600 break-all">
            {(receipt.trackings || []).join(', ') || 'Sin tracking'}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-600">
            <span className="inline-flex items-center gap-1">
              <Package className="h-3 w-3" /> {Number(receipt.cbm || 0).toFixed(4)} CBM
            </span>
            <span className="text-slate-400">·</span>
            <span>{receipt.package_count || 0} paquete(s)</span>
            {fmtDate(receipt.fecha) && (
              <>
                <span className="text-slate-400">·</span>
                <span>Envío: {fmtDate(receipt.fecha)}</span>
              </>
            )}
          </div>
          <p className="mt-1 text-[10px] text-emerald-800/80">
            Facturado{receipt.billing_marked_date ? ` el ${fmtDate(receipt.billing_marked_date)}` : ''}
            {receipt.billing_marked_by ? ` por ${receipt.billing_marked_by}` : ''}
          </p>
        </div>
        <div className="shrink-0 flex flex-col items-center gap-0.5">
          {marking ? (
            <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
          ) : (
            <Checkbox
              checked
              onCheckedChange={() => onUnmark(receipt)}
              title="Quitar la marca: el envío vuelve a la lista facturable"
              aria-label="Quitar la marca de facturado"
              className="border-emerald-600 data-[state=checked]:bg-emerald-600 data-[state=checked]:text-white"
            />
          )}
          <span className="text-[10px] font-medium text-emerald-700">Facturado</span>
        </div>
      </div>
    </div>
  );
}