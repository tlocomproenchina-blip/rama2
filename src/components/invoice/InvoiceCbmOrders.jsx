import React from 'react';
import { Boxes } from 'lucide-react';

// CBM de cada orden/envío de la factura y el total de la factura.
// Los recibos de la factura (manual_recibos) son la fuente: cada uno guarda su
// N° de orden/envío y su CBM, así que el total es la suma de lo que se muestra.

const round4 = (value) => Math.round(Number(value || 0) * 10000) / 10000;

const formatCbm = (value) => {
  const n = round4(value);
  return Number.isFinite(n) ? String(n) : '0';
};

export default function InvoiceCbmOrders({ invoice }) {
  const rows = (Array.isArray(invoice?.manual_recibos) ? invoice.manual_recibos : [])
    .map((recibo, index) => ({
      key: `${index}-${recibo?.invoice_number || ''}`,
      order_number: String(recibo?.invoice_number || '').trim(),
      cbm: Number(recibo?.cbm || 0)
    }))
    .filter((row) => row.order_number);

  const invoiceTotal = Number(invoice?.total_cbm ?? invoice?.cost_breakdown?.total_cbm ?? 0);
  if (rows.length === 0 && !(invoiceTotal > 0)) return null;

  const total = rows.length > 0 ? round4(rows.reduce((sum, row) => sum + row.cbm, 0)) : round4(invoiceTotal);

  return (
    <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
          <Boxes className="h-3.5 w-3.5" /> CBM por orden / envío
        </span>
        <span className="text-xs font-semibold text-slate-800 shrink-0">{formatCbm(total)} CBM</span>
      </div>

      {rows.length > 0 && (
        <div className="mt-2 space-y-1">
          {rows.map((row) => (
            <div key={row.key} className="flex justify-between gap-3">
              <span className="min-w-0 break-words text-slate-600">Orden / envío {row.order_number}</span>
              <span className="shrink-0 font-medium text-slate-800">{formatCbm(row.cbm)} CBM</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 flex justify-between gap-3 border-t border-slate-200 pt-1.5 font-semibold text-slate-800">
        <span>Total CBM</span>
        <span className="shrink-0">{formatCbm(total)} CBM</span>
      </div>
    </div>
  );
}