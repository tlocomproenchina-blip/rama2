import React from 'react';
import { Button } from '@/components/ui/button';
import { Boxes, Package } from 'lucide-react';

// Selector de destino del próximo escaneo. El operador decide si lo que escanea va a un
// bulto suelto o a la caja consolidada; la unidad ya abierta del cliente se retoma sola.
const OPTIONS = [
  { value: 'caja', label: 'Caja consolidada', icon: Boxes },
  { value: 'bulto', label: 'Bulto suelto', icon: Package },
];

export default function PackDestinationSelector({ value, onChange, activeLabel }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/95 p-3 shadow-card">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        Destino del próximo escaneo
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const selected = value === option.value;
          return (
            <Button
              key={option.value}
              variant={selected ? 'default' : 'outline'}
              onClick={() => onChange(option.value)}
              className="h-auto flex-col gap-1 py-2.5"
            >
              <Icon className="h-4 w-4" />
              <span className="text-xs font-semibold">{option.label}</span>
            </Button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {activeLabel
          ? `Unidad activa: ${activeLabel}`
          : 'La unidad abierta del cliente se retoma sola al escanear.'}
      </p>
    </div>
  );
}