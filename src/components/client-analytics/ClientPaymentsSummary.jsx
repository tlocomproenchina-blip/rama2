import React from 'react';
import { CheckCircle2, Clock, DollarSign, Wallet } from 'lucide-react';

const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const money = (value) => `$${num(value).toFixed(2)}`;

// Resumen del movimiento de pago del cliente: lo facturado, lo ya abonado, lo que
// está en validación y lo que queda por cobrar.
export default function ClientPaymentsSummary({ totals }) {
  const cards = [
    {
      label: 'Facturado',
      value: money(totals.billed),
      icon: DollarSign,
      accent: 'bg-slate-100 text-slate-600',
      hint: `${totals.invoices} factura${totals.invoices === 1 ? '' : 's'}`,
    },
    {
      label: 'Abonado',
      value: money(totals.paid),
      icon: CheckCircle2,
      accent: 'bg-emerald-100 text-emerald-700',
      hint: `${totals.approvedCount} abono${totals.approvedCount === 1 ? '' : 's'} aprobado${totals.approvedCount === 1 ? '' : 's'}`,
    },
    {
      label: 'Por validar',
      value: money(totals.pending),
      icon: Clock,
      accent: 'bg-amber-100 text-amber-700',
      hint: `${totals.pendingCount} abono${totals.pendingCount === 1 ? '' : 's'} pendiente${totals.pendingCount === 1 ? '' : 's'}`,
    },
    {
      label: 'Por cobrar',
      value: money(totals.balance),
      icon: Wallet,
      accent: 'bg-rose-100 text-rose-700',
      hint: 'Saldo de las facturas activas',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center gap-2">
              <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${card.accent}`}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-xs font-medium text-slate-500">{card.label}</span>
            </div>
            <p className="mt-2 text-lg font-bold text-slate-800">{card.value}</p>
            <p className="text-[11px] text-slate-400">{card.hint}</p>
          </div>
        );
      })}
    </div>
  );
}