import React, { useState } from 'react';
import { ChevronDown, Printer, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cbmFmt, money } from '@/lib/wholesalerScope';
import { printWholesalerInvoice } from '@/lib/wholesalerInvoicePrint';

// Lista de facturas de un mayorista con su desglose por cliente.
export default function WholesalerInvoiceTable({ invoices, showWholesaler }) {
  const [open, setOpen] = useState(null);
  if (!invoices.length) {
    return <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground"><FileText className="mx-auto mb-2 h-6 w-6" />No hay facturas emitidas.</div>;
  }
  return (
    <div className="divide-y rounded-xl border">
      {invoices.map((inv) => (
        <div key={inv.id}>
          <div className="flex flex-wrap items-center gap-3 p-3">
            <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setOpen(open === inv.id ? null : inv.id)}>
              <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open === inv.id ? 'rotate-180' : ''}`} />
              <span className="font-mono font-semibold">{inv.invoice_number}</span>
              <span className="text-xs text-muted-foreground">{new Date(inv.emitted_date).toLocaleDateString('es-VE')} · {inv.totals?.clients || 0} cliente(s) · {cbmFmt(inv.totals?.cbm)} CBM</span>
              {showWholesaler && <Badge variant="outline">{inv.wholesaler_name}</Badge>}
              {inv.billing_mode === 'manual' && <Badge variant="secondary">Manual</Badge>}
            </button>
            <span className="font-display text-base font-bold">{money(inv.totals?.total)}</span>
            <Button size="sm" variant="outline" onClick={() => printWholesalerInvoice(inv)}><Printer /> Ver / PDF</Button>
          </div>
          {open === inv.id && (
            <div className="overflow-x-auto bg-muted/40 px-3 pb-3">
              <table className="w-full text-xs">
                <thead><tr className="text-left text-muted-foreground"><th className="py-2">Cliente</th><th>CBM</th><th>Paquetes</th><th>Envío</th><th>Puerta a puerta</th><th>Manejo</th><th className="text-right">Total</th></tr></thead>
                <tbody>
                  {(inv.clients || []).map((c, i) => (
                    <tr key={i} className="border-t">
                      <td className="py-2"><p className="font-semibold">{c.client_name}</p><p className="text-muted-foreground">{c.shipping_mark}</p></td>
                      <td>{cbmFmt(c.cbm)}</td>
                      <td>{Number(c.received_trackings ?? c.packages) || 0}</td>
                      <td>{money(c.shipping_amount)} <span className="text-muted-foreground">({money(c.rate_per_cbm)}/CBM)</span></td>
                      <td>{money(c.door_to_door_amount)} <span className="text-muted-foreground">({c.door_to_door_per_cbm != null ? `${money(c.door_to_door_per_cbm)}/CBM` : `${money(c.rate_per_bulto)}/bulto`})</span></td>
                      <td>{money(c.handling_amount)}</td>
                      <td className="text-right font-semibold">{money(c.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}