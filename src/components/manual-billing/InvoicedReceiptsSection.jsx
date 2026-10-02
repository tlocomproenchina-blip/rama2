import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronDown, History } from 'lucide-react';
import InvoicedInvoiceGroup from './InvoicedInvoiceGroup';

const timeOf = (v) => {
  if (!v) return 0;
  const d = new Date(String(v).includes('T') ? v : `${v}T12:00:00`);
  const t = d.getTime();
  return Number.isNaN(t) ? 0 : t;
};

// Envíos/recibos que ya se facturaron en el sistema: se conservan agrupados por factura
// (de la más reciente a la más antigua) para revisarlos en el mismo expediente, sin
// salir a la pantalla de Facturas. Solo se muestran: no se pueden volver a facturar.
export default function InvoicedReceiptsSection({ receipts = [] }) {
  const [open, setOpen] = useState(false);

  const groups = useMemo(() => {
    const map = new Map();
    for (const receipt of receipts) {
      const key = receipt.invoice_id || '__sin_factura__';
      if (!map.has(key)) {
        map.set(key, {
          key,
          invoice_number: receipt.invoice_number,
          invoice_date: receipt.invoice_date,
          invoice_status: receipt.invoice_status,
          invoice_total: receipt.invoice_total,
          receipts: [],
        });
      }
      map.get(key).receipts.push(receipt);
    }
    return [...map.values()]
      .map((group) => ({
        ...group,
        receipts: [...group.receipts].sort((a, b) => timeOf(b.fecha) - timeOf(a.fecha)),
      }))
      .sort((a, b) => timeOf(b.invoice_date) - timeOf(a.invoice_date));
  }, [receipts]);

  if (receipts.length === 0) return null;

  return (
    <Card className="border border-border bg-card">
      <CardContent className="p-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 p-4 text-left"
        >
          <span className="inline-flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            <History className="h-4 w-4" /> Envíos ya facturados ({receipts.length})
          </span>
          <ChevronDown className={`h-4 w-4 text-primary transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="space-y-3 px-4 pb-4">
            <p className="text-[11px] text-muted-foreground">
              Ya se facturaron en el sistema: quedan aquí como referencia y no vuelven a la lista facturable.
            </p>
            {groups.map((group) => (
              <InvoicedInvoiceGroup key={group.key} group={group} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}