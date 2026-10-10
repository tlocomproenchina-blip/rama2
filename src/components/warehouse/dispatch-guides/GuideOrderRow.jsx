import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

const num = (value) => Number(value) || 0;

const fmtDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-VE');
};

// Una orden / envío que se puede meter en la guía: con sus bultos registrados si los
// tiene, o como línea de carga sin bulto registrado si el bulto no existe.
export default function GuideOrderRow({ order, selected, onToggle }) {
  const blocked = !!order.already_in_guide;

  return (
    <label
      className={`flex items-start gap-2.5 rounded-xl border p-2.5 transition-colors ${
        blocked
          ? 'border-border/60 bg-muted/40'
          : 'cursor-pointer border-border/70 hover:bg-accent/50'
      } ${selected ? 'ring-1 ring-primary/40' : ''}`}
    >
      <Checkbox
        checked={!!selected}
        disabled={blocked}
        onCheckedChange={() => onToggle(order)}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800">Orden / envío {order.order_number}</p>
        <p className="text-[11px] text-slate-500 break-all">
          {order.client_name}
          {order.shipping_mark ? ` · Mark: ${order.shipping_mark}` : ''}
        </p>
        <p className="text-[11px] text-slate-500">
          {num(order.cbm_total).toFixed(3)} CBM · {num(order.packages_total)} paquete(s)
          {order.invoice_number ? ` · Factura ${order.invoice_number}` : ''}
          {order.fecha ? ` · ${fmtDate(order.fecha)}` : ''}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          {order.unregistered ? (
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
              Sin bulto registrado
            </Badge>
          ) : (
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
              {num(order.bultos_total)} bulto(s) registrado(s)
            </Badge>
          )}
          {blocked && (
            <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
              Ya en guía {order.guide_number || ''}
            </Badge>
          )}
          {order.billing_marked && (
            <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
              Ya facturado a mano
            </Badge>
          )}
        </div>
      </div>
    </label>
  );
}