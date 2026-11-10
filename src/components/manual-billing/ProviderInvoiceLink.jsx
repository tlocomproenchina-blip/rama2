import React from 'react';
import { FileText, FileX } from 'lucide-react';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

// Vínculo del recibo con la factura de proveedor: muestra su CBM o indica que falta.
export default function ProviderInvoiceLink({ providerInvoice }) {
  if (!providerInvoice) {
    return (
      <div className="inline-flex items-center gap-2 rounded-xl border border-dashed border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
        <FileX className="h-3.5 w-3.5" /> Sin factura de proveedor
      </div>
    );
  }
  const paid = providerInvoice.status === 'pagada';
  return (
    <div className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-success/30 bg-success-bg px-3 py-1.5 text-xs text-success">
      <span className="inline-flex items-center gap-1.5 font-semibold">
        <FileText className="h-3.5 w-3.5" /> Factura proveedor {providerInvoice.invoice_code}
      </span>
      <span className="font-display text-sm font-bold">{Number(providerInvoice.cbm || 0)} CBM</span>
      <span className="opacity-80">{money(providerInvoice.total)} · {paid ? 'Pagada' : 'No pagada'}</span>
      {providerInvoice.invoice_file_url && (
        <a href={providerInvoice.invoice_file_url} target="_blank" rel="noreferrer" className="underline underline-offset-2">Ver</a>
      )}
    </div>
  );
}