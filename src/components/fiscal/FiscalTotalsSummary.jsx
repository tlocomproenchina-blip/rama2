import React from 'react';
import { money } from '@/lib/fiscalCalc';

const Row = ({ label, value }) => (
  <div className="flex items-center justify-between text-sm">
    <span className="font-semibold tracking-wide text-muted-foreground">{label}</span>
    <span className="font-semibold tabular-nums text-foreground">{value}</span>
  </div>
);

// Resumen de importes (esquina inferior derecha de la tabla de detalle).
export default function FiscalTotalsSummary({ subtotal, vat, total }) {
  return (
    <div className="ml-auto w-full max-w-sm space-y-2.5 rounded-2xl border border-border bg-card p-4 shadow-card">
      <Row label="SUBTOTAL" value={money(subtotal)} />
      <Row label="IVA (16 %)" value={money(vat)} />
      <div className="flex items-center justify-between rounded-xl bg-secondary px-3 py-3 text-secondary-foreground">
        <span className="text-sm font-bold">TOTAL CON IVA</span>
        <span className="text-xl font-extrabold tabular-nums text-primary">{money(total)}</span>
      </div>
    </div>
  );
}