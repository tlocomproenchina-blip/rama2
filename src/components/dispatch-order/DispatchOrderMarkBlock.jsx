import React from 'react';
import DispatchOrderUnitChip from '@/components/dispatch-order/DispatchOrderUnitChip';
import { unitsLabel } from '@/lib/dispatchOrderCounts';

// Un cliente (shipping mark) con sus órdenes/envíos y, al final, el total de bultos.
export default function DispatchOrderMarkBlock({ mark }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
      <p className="text-sm font-semibold text-foreground">
        {mark.shipping_mark}
        {mark.client_name ? ` · ${mark.client_name}` : ''}
      </p>
      <div className="mt-2 space-y-2">
        {(mark.orders || []).map((order) => (
          <div key={order.order_number} className="rounded-lg border border-border/60 bg-card p-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Orden/Envío {order.order_number}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(order.units || []).length === 0 ? (
                <span className="text-xs text-muted-foreground">Sin cajas ni bultos registrados</span>
              ) : (
                (order.units || []).map((unit, index) => (
                  <DispatchOrderUnitChip key={`${unit.code}-${index}`} unit={unit} />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 border-t border-border/60 pt-2 text-sm font-semibold text-foreground">
        Total {mark.shipping_mark}: {unitsLabel(mark.cajas, mark.bultos_sueltos)}
      </p>
    </div>
  );
}