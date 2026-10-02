import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// X/N escrito a mano para la etiqueta de una unidad: es tal cual lo que sale impreso en
// la tira continua y lo que queda guardado en la guía de despacho.
export default function LabelNumberInputs({ index = '', total = '', onChange, disabled = false }) {
  return (
    <div className="mt-2 flex flex-wrap items-end gap-2 pl-7">
      <div className="space-y-1">
        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">N°</Label>
        <Input
          type="number"
          inputMode="numeric"
          min="1"
          value={index}
          onChange={(e) => onChange('index', e.target.value)}
          className="h-9 w-16 text-center"
          disabled={disabled}
        />
      </div>
      <span className="pb-2 text-sm text-muted-foreground">/</span>
      <div className="space-y-1">
        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</Label>
        <Input
          type="number"
          inputMode="numeric"
          min="1"
          value={total}
          onChange={(e) => onChange('total', e.target.value)}
          className="h-9 w-16 text-center"
          disabled={disabled}
        />
      </div>
      <p className="pb-2 text-[10px] text-muted-foreground">Lo que sale impreso en la etiqueta</p>
    </div>
  );
}