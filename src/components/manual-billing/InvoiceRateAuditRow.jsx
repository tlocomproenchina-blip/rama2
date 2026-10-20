import React from 'react';
import { Badge } from '@/components/ui/badge';

const money = (v) => `$${Number(v || 0).toFixed(2)}`;

// Ficha de una factura dentro de la revisión de tarifas: corregida, sin novedad o
// pendiente de revisión manual.
export default function InvoiceRateAuditRow({ kind, item }) {
  const head = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-medium text-slate-800">{item.invoice_number}</span>
      <Badge variant="outline">{item.status}</Badge>
      <span className="text-xs text-muted-foreground">{item.client_email}</span>
    </div>
  );

  if (kind === 'review') {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50/60 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
        {head}
        <p className="mt-1 text-amber-900 dark:text-amber-100">{item.reason}</p>
        {item.shipping_stored !== undefined && (
          <p className="mt-1 text-xs text-slate-600">
            Envío en la factura: {money(item.shipping_stored)} · con las tarifas vigentes serían {money(item.expected_general)} si toda la carga es regular
            o {money(item.expected_high_risk)} si toda es de alto riesgo.
          </p>
        )}
      </div>
    );
  }

  if (kind === 'corrected') {
    return (
      <div className="rounded-lg border border-emerald-300 bg-emerald-50/60 p-3 text-sm dark:border-emerald-800 dark:bg-emerald-950/30">
        {head}
        <p className="mt-1 text-slate-700">
          Envío {money(item.shipping_before)} → <strong>{money(item.shipping_after)}</strong> · Total {money(item.total_before)} → <strong>{money(item.total_after)}</strong>
        </p>
        <p className="mt-1 text-xs text-slate-600">
          {item.receipts?.length || 0} recibo(s) recotizados con la tarifa de su fecha, su tipo de carga y el estado del cliente.
        </p>
        {item.overpaid && (
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
            Tenía pagos registrados por {money(item.paid_amount)}: el nuevo total queda por debajo. Revisa si corresponde dejarle un saldo a favor al cliente.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2 text-sm">
      <span className="font-medium text-slate-700">{item.invoice_number}</span>
      <span className="text-xs text-muted-foreground">{item.client_email}</span>
      <span className="ml-auto text-slate-700">{money(item.shipping)}</span>
      {item.no_type && <Badge variant="outline" className="text-xs">sin tipo de carga por recibo</Badge>}
    </div>
  );
}