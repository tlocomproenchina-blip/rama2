import React from 'react';
import { Check } from 'lucide-react';

const STEPS = ['Datos fiscales', 'Detalle', 'Resumen y pago del IVA', 'Confirmación'];

export default function FiscalStepper({ current, onStep, maxStep = 3 }) {
  return (
    <ol className="grid grid-cols-4 gap-2">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        const clickable = n <= maxStep && onStep;
        return (
          <li key={label} className="min-w-0">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStep(n)}
              className="flex w-full flex-col items-center gap-1.5 text-center"
            >
              <span className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold ${active ? 'border-primary bg-primary text-primary-foreground' : done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-border bg-card text-muted-foreground'}`}>
                {done ? <Check className="h-4 w-4" /> : n}
              </span>
              <span className={`text-[11px] font-semibold leading-tight ${active ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}