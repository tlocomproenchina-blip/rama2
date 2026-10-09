import React from 'react';
import { unitsLabel } from '@/lib/dispatchOrderCounts';

// Un cliente (shipping mark) con sus órdenes/envíos, el conteo de carga de cada una
// y, al final, el total del cliente. Sin códigos de bulto.
export default function DispatchOrderMarkBlock({ mark }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
      <p className="text-sm font-semibold text-foreground">
        {mark.shipping_mark}
        {mark.client_name ? ` · ${mark.client_name}` : ''}
      </p>
      <div className="mt-2 space-y-1.5">
        {(mark.orders || []).map((order) => (
          <div
            key={order.order_number}
            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-border/60 bg-card px-2.5 py-1.5"
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">
              Orden/Envío {order.order_number}
            </span>
            <span className="text-xs font-medium text-foreground">
              {(order.units || []).length === 0
                ? 'Sin cajas ni bultos registrados'
                : unitsLabel(order.cajas, order.bultos_sueltos)}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 border-t border-border/60 pt-2 text-sm font-semibold text-foreground">
        Total {mark.shipping_mark}: {unitsLabel(mark.cajas, mark.bultos_sueltos)}
      </p>
    </div>
  );
}