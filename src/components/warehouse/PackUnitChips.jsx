import React from 'react';
import { Boxes, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

// Unidades que se están armando en este dispositivo (bultos y cajas): se cambia de
// destino con un toque, sin volver a escanear el código.
export default function PackUnitChips({ units = [], activeId, onSelect }) {
  if (!units.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {units.map((unit) => {
        const active = unit.id === activeId;
        return (
          <button
            key={unit.id}
            type="button"
            onClick={() => onSelect(unit.id)}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors touch-manipulation',
              active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border/70 bg-card text-foreground hover:bg-accent'
            )}
          >
            {unit.is_caja ? <Boxes className="h-3.5 w-3.5" /> : <Package className="h-3.5 w-3.5" />}
            <span className="font-mono break-all">{unit.label_code}</span>
          </button>
        );
      })}
    </div>
  );
}