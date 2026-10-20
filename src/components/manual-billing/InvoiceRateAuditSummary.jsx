import React from 'react';
import { Card } from '@/components/ui/card';

const TILES = [
  { key: 'reviewed', label: 'Revisadas', tone: 'text-slate-800' },
  { key: 'corrected', label: 'Corregidas', tone: 'text-emerald-600' },
  { key: 'verified', label: 'Sin novedad', tone: 'text-slate-800' },
  { key: 'review', label: 'Por revisar', tone: 'text-amber-600' },
];

// Contadores de la revisión de tarifas: cuántas facturas se revisaron, cuántas se
// corrigieron solas, cuántas ya estaban bien y cuántas quedan para revisión manual.
export default function InvoiceRateAuditSummary({ reviewed = 0, summary = {} }) {
  const values = {
    reviewed,
    corrected: summary.corrected || 0,
    verified: summary.verified || 0,
    review: summary.review || 0,
  };
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {TILES.map((t) => (
        <Card key={t.key} className="border border-border p-3">
          <p className="text-xs text-muted-foreground">{t.label}</p>
          <p className={`text-2xl font-semibold ${t.tone}`}>{values[t.key]}</p>
        </Card>
      ))}
    </div>
  );
}