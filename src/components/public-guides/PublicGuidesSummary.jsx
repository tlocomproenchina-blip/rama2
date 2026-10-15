import React from 'react';

const METRICS = [
  { key: 'guides', label: 'Guía(s)' },
  { key: 'clients', label: 'Cliente(s)' },
  { key: 'bultos', label: 'Bulto(s)' },
  { key: 'packages', label: 'Paquete(s)' },
];

// Totales de los resultados que se están mostrando: guías, clientes, bultos y
// paquetes sumados de las guías ya cargadas.
export default function PublicGuidesSummary({ totals, hasMore }) {
  const number = (value) => (Number(value) || 0).toLocaleString('es-VE');
  return (
    <div className="rounded-2xl border border-border bg-card p-3 md:p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {METRICS.map((metric) => (
          <div key={metric.key} className="rounded-xl bg-muted/50 px-3 py-2">
            <p className="font-display text-xl font-bold text-foreground">{number(totals?.[metric.key])}</p>
            <p className="text-[11px] text-muted-foreground">{metric.label}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Totales de los resultados mostrados{hasMore ? ' · hay más guías por cargar' : ''}.
      </p>
    </div>
  );
}