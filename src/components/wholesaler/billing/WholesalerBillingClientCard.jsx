import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { draftAmounts } from '@/lib/wholesalerBillingCalc';
import WholesalerBillingOrderRow from './WholesalerBillingOrderRow';
import WholesalerBillingNewOrderForm from './WholesalerBillingNewOrderForm';

function MoneyLine({ label, detail, value }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="min-w-0 text-muted-foreground">
        {label}
        {detail ? <span className="block text-xs text-muted-foreground/80">{detail}</span> : null}
      </span>
      <span className="shrink-0 font-medium text-foreground">${Number(value || 0).toFixed(2)}</span>
    </div>
  );
}

// Un cliente dentro del lote: sus tarifas, sus órdenes/envíos y el total que
// le corresponde pagar.
export default function WholesalerBillingClientCard({ draft, onChange, onRemove }) {
  const amounts = draftAmounts(draft);

  const patchOrder = (index, patch) => {
    onChange({ orders: draft.orders.map((order, position) => (position === index ? { ...order, ...patch } : order)) });
  };

  // Trackings recibidos del cliente que todavía no están en ninguna orden: se
  // pueden enganchar a la orden que se está facturando.
  const allPicked = draft.orders.reduce((acc, order) => acc.concat(order.picked || []), []);
  const optionsFor = (order) => (draft.available || [])
    .map((item) => item.tracking_number)
    .filter((tracking) => !allPicked.includes(tracking) || (order.picked || []).includes(tracking));

  const addOrder = (order) => {
    onChange({
      orders: [
        ...draft.orders,
        {
          order_number: order.order_number,
          cbm: order.cbm,
          bultos: Math.max(Number(order.bultos) || 0, 0),
          is_new: true,
          checked: true,
          picked: order.trackings || [],
          trackings_count: 0,
          received: 0,
        },
      ],
    });
  };

  return (
    <Card className="rounded-2xl border-0 shadow-card">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div className="min-w-0">
          <CardTitle className="truncate text-base font-semibold text-foreground">
            {draft.client_name}
          </CardTitle>
          <p className="truncate text-xs text-muted-foreground">
            {draft.client_email}{draft.shipping_mark ? ` · ${draft.shipping_mark}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="secondary">${amounts.total.toFixed(2)}</Badge>
          {onRemove && (
            <button type="button" onClick={onRemove} className="text-xs text-muted-foreground underline-offset-2 hover:underline">
              Quitar
            </button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Tarifa de envío (USD por bulto)</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={draft.rate_per_bulto}
              onChange={(event) => onChange({ rate_per_bulto: event.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Puerta a puerta (USD por bulto)</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={draft.door_to_door_per_bulto}
              onChange={(event) => onChange({ door_to_door_per_bulto: event.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Órdenes / envíos</p>
          {draft.orders.length ? (
            draft.orders.map((order, index) => (
              <WholesalerBillingOrderRow
                key={`${order.order_number}-${index}`}
                order={order}
                options={optionsFor(order)}
                onChange={(patch) => patchOrder(index, patch)}
                onRemove={() => onChange({ orders: draft.orders.filter((_, position) => position !== index) })}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Este cliente no tiene órdenes pendientes por facturar. Puedes crearle una aquí abajo.
            </p>
          )}
        </div>

        <WholesalerBillingNewOrderForm available={draft.available} onAdd={addOrder} />

        <div className="space-y-2 rounded-xl bg-accent/40 p-3">
          <MoneyLine
            label="Servicio de envío"
            detail={`${amounts.bultos} bulto(s) × $${Number(draft.rate_per_bulto || 0).toFixed(2)}`}
            value={amounts.shipping}
          />
          <MoneyLine
            label="Servicio puerta a puerta"
            detail={`${amounts.bultos} bulto(s) × $${Number(draft.door_to_door_per_bulto || 0).toFixed(2)}`}
            value={amounts.doorToDoor}
          />
          <MoneyLine
            label="Manejo de paquetes"
            detail={`${amounts.received} tracking(s) recibido(s) × $1.00`}
            value={amounts.handling}
          />
          <div className="flex items-center justify-between border-t border-border/60 pt-2 text-sm font-semibold text-foreground">
            <span>Total del cliente</span>
            <span>${amounts.total.toFixed(2)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}