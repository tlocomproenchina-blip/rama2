import React from 'react';

const OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'caja', label: 'Cajas consolidadas' },
  { value: 'suelto', label: 'Bultos sueltos' },
];

// Filtro por tipo de unidad: todas, solo cajas consolidadas o solo bultos sueltos.
export default function UnitKindFilter({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${value === o.value ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-slate-600 hover:bg-accent'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}