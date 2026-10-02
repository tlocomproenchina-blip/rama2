import React from 'react';
import { Button } from '@/components/ui/button';
import { Boxes } from 'lucide-react';
import UnitBatchRow from './UnitBatchRow';

// Unidades del cliente que se marcan para armar el lote de etiquetas: sus cajas
// consolidadas y sus bultos sueltos. Una unidad ya incluida en otra guía se avisa, pero
// no se bloquea ni se esconde: el operador decide si entra igual al lote.
export default function UnitBatchList({
  units,
  selected,
  labels,
  onToggle,
  onToggleAll,
  onNumberChange,
  disabled = false,
}) {
  const list = Array.isArray(units) ? units : [];
  const allSelected = list.length > 0 && selected.length === list.length;

  if (!list.length) {
    return (
      <p className="rounded-xl border border-border/70 bg-muted/40 p-3 text-xs text-muted-foreground">
        Este cliente no tiene cajas ni bultos por despachar.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {selected.length} de {list.length} unidad(es) marcadas
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onToggleAll} disabled={disabled}>
          <Boxes className="h-3.5 w-3.5" /> {allSelected ? 'Quitar todas' : 'Marcar todas'}
        </Button>
      </div>

      {list.map((unit) => (
        <UnitBatchRow
          key={unit.id || unit.label_code}
          unit={unit}
          checked={selected.includes(unit.label_code)}
          number={labels[unit.label_code]}
          onToggle={onToggle}
          onNumberChange={onNumberChange}
          disabled={disabled}
        />
      ))}
    </div>
  );
}