import React from 'react';
import { money } from '@/lib/providerInvoicesApi';

export default function ProviderInvoiceTotals({ totals }) {
  if (!totals) return null;
  const cards = [
    { label: 'Saldo deudor', value: totals.pending, count: totals.pending_count, cls: 'text-warning bg-warning-bg' },
    { label: 'Saldo pagado', value: totals.paid, count: totals.paid_count, cls: 'text-success bg-success-bg' },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {cards.map((c) => (
        <div key={c.label} className={`rounded-2xl border p-4 ${c.cls}`}>
          <p className="text-xs font-semibold uppercase tracking-wider">{c.label}</p>
          <p className="font-display text-2xl font-bold">{money(c.value)}</p>
          <p className="text-xs opacity-80">{c.count} factura{c.count === 1 ? '' : 's'}</p>
        </div>
      ))}
    </div>
  );
}