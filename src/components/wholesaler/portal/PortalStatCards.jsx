import React from 'react';
import { money } from '@/lib/wholesalerScope';

export default function PortalStatCards({ data }) {
  const total = (data.invoices || []).reduce((s, i) => s + (Number(i.totals?.total) || 0), 0);
  const cards = [
    ['Clientes', data.clients.length],
    ['Trackings', data.trackings.length],
    ['Facturas', data.invoices.length],
    ['Total facturado', money(total)],
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-l-4 border-l-primary bg-card p-4 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
          <p className="font-display text-2xl font-bold">{value}</p>
        </div>
      ))}
    </div>
  );
}