import React from 'react';

const TONES = {
  neutral: 'text-foreground',
  ok: 'text-success',
  warn: 'text-warning',
  bad: 'text-destructive',
  muted: 'text-muted-foreground',
};

// Una fuente del conteo (registros del sistema o escaneos físicos) con su total y su desglose.
export default function ReconciliationSourceCard({ icon: Icon, eyebrow, title, total, totalLabel, rows = [] }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{eyebrow}</p>
          <h3 className="mt-1 font-display text-base font-semibold text-foreground">{title}</h3>
        </div>
        {Icon && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Icon className="h-5 w-5" />
          </span>
        )}
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="font-display text-3xl font-bold tabular-nums text-foreground">{total.toLocaleString('es-VE')}</span>
        <span className="text-xs text-muted-foreground">{totalLabel}</span>
      </div>
      <dl className="mt-4 space-y-2 border-t border-border/60 pt-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-3 text-sm">
            <dt className="min-w-0 text-muted-foreground">
              {row.label}
              {row.hint && <span className="block text-[11px] text-muted-foreground/80">{row.hint}</span>}
            </dt>
            <dd className={`shrink-0 font-semibold tabular-nums ${TONES[row.tone || 'neutral']}`}>
              {Number(row.value || 0).toLocaleString('es-VE')}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}