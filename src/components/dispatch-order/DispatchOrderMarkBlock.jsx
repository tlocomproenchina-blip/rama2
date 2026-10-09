import React from 'react';
import DispatchOrderUnitChip from '@/components/dispatch-order/DispatchOrderUnitChip';

// Un cliente (shipping mark) con sus órdenes/envíos pagados y lo que hay que buscar.
export default function DispatchOrderMarkBlock({ mark }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">
          {mark.shipping_mark}
          {mark.client_name ? ` · ${mark.client_name}` : ''}
        </p>
        <p className="text-xs text-muted-foreground">
          {mark.cajas || 0} caja(s) + {mark.bultos_sueltos || 0} bulto(s) suelto(s) = {mark.total_unidades || 0} unidad(es)
        </p>
      </div>
      <div className="mt-2 space-y-2">
        {(mark.orders || []).map((order) => (
          <div key={order.order_number} className="rounded-lg border border-border/60 bg-card p-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Orden/Envío {order.order_number}
              </p>
              {(order.invoice_numbers || []).length > 0 && (
                <span className="text-xs text-muted-foreground">Factura {order.invoice_numbers.join(', ')}</span>
              )}
            </div>
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
    </div>
  );
}