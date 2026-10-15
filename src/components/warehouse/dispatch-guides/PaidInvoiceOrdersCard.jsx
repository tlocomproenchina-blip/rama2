import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, ChevronUp } from 'lucide-react';
import GuideOrderRow from './GuideOrderRow';

const num = (value) => Number(value) || 0;

const fmtDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-VE');
};

// Una factura pagada con sus contenedores: se marcan las que van en la guía,
// aunque la carga todavía no tenga bulto registrado.
export default function PaidInvoiceOrdersCard({ invoice, selected, onToggleOrder, onToggleMany }) {
  const [open, setOpen] = useState(false);
  const orders = Array.isArray(invoice.orders) ? invoice.orders : [];
  const selectable = orders.filter((order) => !order.already_in_guide);
  const chosen = selectable.filter((order) => selected.has(order.key)).length;
  const allSelected = selectable.length > 0 && chosen === selectable.length;

  return (
    <div className="rounded-xl border border-border/70 p-3">
      <div className="flex items-start gap-3">
        <Checkbox
          checked={allSelected ? true : chosen ? 'indeterminate' : false}
          disabled={!selectable.length}
          onCheckedChange={() => onToggleMany(selectable)}
          className="mt-0.5"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="font-mono text-[12px] font-bold text-slate-800 break-all">{invoice.invoice_number}</p>
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
              Pagada
            </Badge>
          </div>
          <p className="text-[11px] text-slate-500 break-all">
            {invoice.client_name}
            {invoice.shipping_mark ? ` · Mark: ${invoice.shipping_mark}` : ''}
          </p>
          <p className="text-[11px] text-slate-500">
            ${num(invoice.total).toFixed(2)} · {orders.length} contenedor(es)
            {invoice.payment_date ? ` · Pagada ${fmtDate(invoice.payment_date)}` : ''}
            {chosen ? ` · ${chosen} marcada(s)` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-border/70 px-2 py-1 text-[11px] font-semibold text-slate-600"
        >
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          Contenedores
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
          {orders.length === 0 ? (
            <p className="text-[11px] text-slate-500">Esta factura no tiene contenedores vinculados.</p>
          ) : (
            orders.map((order) => (
              <GuideOrderRow
                key={order.key}
                order={order}
                selected={selected.has(order.key)}
                onToggle={onToggleOrder}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}