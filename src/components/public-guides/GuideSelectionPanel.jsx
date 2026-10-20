import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckSquare, Square, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';

// Selección de guías completas en el portal público: cada guía se marca entera
// y los botones Imprimir / Descargar PDF salen solo con las guías marcadas.
export default function GuideSelectionPanel({ guides = [], selected = [], onToggle, onClear }) {
  if (guides.length === 0) return null;
  const selectedSet = new Set(selected);

  return (
    <Card className="border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <ListChecks className="h-4 w-4 text-primary" />
          Guías para imprimir
          <span className="font-normal text-muted-foreground">
            ({selected.length === 0 ? 'todas las guías' : `${selected.length} seleccionada${selected.length === 1 ? '' : 's'}`})
          </span>
        </p>
        {selected.length > 0 && (
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onClear}>
            Quitar selección
          </Button>
        )}
      </div>

      <div className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto pr-1">
        {guides.map((guide) => {
          const active = selectedSet.has(guide.number);
          return (
            <button
              key={guide.number}
              type="button"
              onClick={() => onToggle(guide.number)}
              aria-pressed={active}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-foreground hover:bg-accent/60'
              )}
            >
              {active ? <CheckSquare className="h-3 w-3" /> : <Square className="h-3 w-3 opacity-60" />}
              {guide.number}
            </button>
          );
        })}
      </div>
    </Card>
  );
}