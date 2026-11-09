import React from 'react';

// Fila de pestañas rápidas desplazable (cómoda en móvil) con conteo por opción.
export default function QuickFilterTabs({ label, options, value, onChange }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`shrink-0 inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-border bg-card text-slate-700 hover:bg-accent'
              }`}
            >
              {opt.label}
              <span className={`rounded-full px-1.5 text-xs ${active ? 'bg-black/10' : 'bg-muted text-slate-500'}`}>{opt.count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}