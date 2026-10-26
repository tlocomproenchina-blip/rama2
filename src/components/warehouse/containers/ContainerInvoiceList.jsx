import React from 'react';
import { Receipt } from 'lucide-react';

const STATUS_STYLES = {
  pendiente: 'border-amber-200 bg-amber-50 text-amber-700',
  revision: 'border-sky-200 bg-sky-50 text-sky-700',
  pagada: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  vencida: 'border-rose-200 bg-rose-50 text-rose-700',
  cancelada: 'border-slate-200 bg-slate-100 text-slate-600',
};

const money = (value) => `$${Number(value || 0).toFixed(2)}`;
const shortDate = (value) => (value ? new Date(value).toLocaleDateString('es-VE') : '—');

// Facturas del contenedor con su estado de pago y saldo.
export default function ContainerInvoiceList({ invoices = [] }) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <Receipt className="h-3.5 w-3.5" /> Facturas
      </p>
      {!invoices.length && <p className="text-xs text-slate-500">Sin facturas generadas.</p>}
      {invoices.map((invoice) => (
        <div key={invoice.id} className="rounded-lg border border-slate-200 px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-800">{invoice.invoice_number}</span>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[invoice.status] || STATUS_STYLES.pendiente}`}>
              {invoice.status}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
            <span>Total {money(invoice.total)}</span>
            <span>Pagado {money(invoice.paid_amount)}</span>
            <span className={invoice.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}>
              Saldo {money(invoice.balance)}
            </span>
            <span className="text-slate-400">{shortDate(invoice.invoice_date)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}