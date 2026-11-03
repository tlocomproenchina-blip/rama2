import React from 'react';

const OPTIONS = [
  { value: 'sin_responder', label: 'Sin responder' },
  { value: 'respondidos', label: 'Respondidos' },
  { value: 'todos', label: 'Todos' },
];

// Filtro de los casos escalados según si Supervisión ya respondió o no.
export default function ReplyStatusFilter({ value, onChange, counts = {} }) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl border border-border/70 bg-muted/40 p-1">
      {OPTIONS.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
              active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-card hover:text-foreground'
            }`}
          >
            {option.label}
            {counts[option.value] != null ? <span className="ml-1 opacity-80">({counts[option.value]})</span> : null}
          </button>
        );
      })}
    </div>
  );
}