import React from 'react';

const OPTIONS = [7, 30, 90];

export default function ReconciliationPeriodPicker({ value, onChange }) {
  return (
    <div className="inline-flex rounded-full bg-muted p-1">
      {OPTIONS.map((d) => (
        <button
          key={d}
          onClick={() => onChange(d)}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${value === d ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          {d} días
        </button>
      ))}
    </div>
  );
}