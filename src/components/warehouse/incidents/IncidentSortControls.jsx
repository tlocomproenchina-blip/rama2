import React from 'react';
import { ArrowDownWideNarrow, ArrowUpNarrowWide, CalendarClock, Layers } from 'lucide-react';

const btn = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors';
const on = 'bg-card text-foreground shadow-sm';
const off = 'text-muted-foreground hover:text-foreground';

// Controles compactos para ordenar el historial: por fecha de reporte
// (ascendente/descendente) o agrupado por tipo de incidencia (prioridad).
export default function IncidentSortControls({ mode, dir, onModeChange, onDirChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-xl border border-border bg-muted p-1">
        <button type="button" className={`${btn} ${mode === 'type' ? on : off}`} onClick={() => onModeChange('type')}>
          <Layers className="h-3.5 w-3.5" /> Prioridad por tipo
        </button>
        <button type="button" className={`${btn} ${mode === 'date' ? on : off}`} onClick={() => onModeChange('date')}>
          <CalendarClock className="h-3.5 w-3.5" /> Fecha de reporte
        </button>
      </div>
      <button
        type="button"
        onClick={() => onDirChange(dir === 'desc' ? 'asc' : 'desc')}
        className={`${btn} border border-border bg-card text-foreground hover:bg-accent`}
        title="Cambiar orden de fecha"
      >
        {dir === 'desc' ? <ArrowDownWideNarrow className="h-3.5 w-3.5" /> : <ArrowUpNarrowWide className="h-3.5 w-3.5" />}
        {dir === 'desc' ? 'Más recientes primero' : 'Más antiguos primero'}
      </button>
    </div>
  );
}