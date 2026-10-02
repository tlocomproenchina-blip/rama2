import React from 'react';
import { Package } from 'lucide-react';

const fmtDate = (v) => {
  if (!v) return null;
  const d = new Date(String(v).includes('T') ? v : `${v}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('es-VE');
};

// Un envío/recibo que ya se facturó en el sistema: solo se muestra, no se puede
// seleccionar ni devolver a la lista facturable.
export default function InvoicedReceiptRow({ receipt }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-2.5">
      <p className="font-mono text-sm font-semibold text-foreground break-all">
        {receipt.order || 'Sin N° de orden'}
      </p>
      <p className="text-[11px] text-muted-foreground break-all">
        {(receipt.trackings || []).join(', ') || 'Sin tracking'}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
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
    </div>
  );
}