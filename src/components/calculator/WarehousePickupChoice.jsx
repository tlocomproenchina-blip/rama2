import React from 'react';
import { Warehouse, Truck, Check } from 'lucide-react';

const OPTIONS = [
  { value: 'si', icon: Warehouse, title: 'Sí, retiro en almacén', text: 'Buscas tu carga en nuestro almacén.' },
  { value: 'no', icon: Truck, title: 'No, entrega puerta a puerta', text: 'Te lo llevamos hasta la puerta de tu casa.' }
];

export default function WarehousePickupChoice({ value, onChange }) {
  return (
    <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/40 p-4">
      <div>
        <p className="font-display text-base font-semibold text-foreground">¿Retiras tu carga en almacén?</p>
        <p className="text-sm text-muted-foreground">Elige cómo quieres recibirla.</p>
      </div>
      <div role="radiogroup" className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map(({ value: v, icon: Icon, title, text }) => {
          const active = value === v;
          return (
            <button key={v} type="button" role="radio" aria-checked={active} onClick={() => onChange(v)}
              className={`relative flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all duration-200 ${active ? 'border-primary bg-accent shadow-card' : 'border-border bg-card hover:border-primary/40'}`}>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1 whitespace-normal">
                <span className="block font-semibold text-foreground">{title}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{text}</span>
              </span>
              {active && <Check className="absolute right-3 top-3 h-4 w-4 text-accent-foreground" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}