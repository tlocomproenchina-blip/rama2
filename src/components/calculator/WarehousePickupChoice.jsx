import React from 'react';
import { Warehouse, Truck, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DOOR_TO_DOOR_RATE_PER_CBM } from '@/lib/doorToDoor';

const OPTIONS = [
  { value: 'si', icon: Warehouse, title: 'Sí, retiro en almacén', text: 'Buscas tu carga en nuestro almacén. Sin cargo de entrega.' },
  { value: 'no', icon: Truck, title: 'No, entrega puerta a puerta', text: `La llevamos a tu dirección: $${DOOR_TO_DOOR_RATE_PER_CBM} por CBM, a cualquier destino.` }
];

export default function WarehousePickupChoice({ value, onChange, door }) {
  return (
    <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/40 p-4">
      <div>
        <p className="font-display text-base font-semibold text-foreground">¿Retiras tu carga en almacén?</p>
        <p className="text-sm text-muted-foreground">Elige cómo quieres recibirla para completar tu estimado.</p>
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
      <AnimatePresence initial={false}>
        {value === 'no' && door && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-card px-4 py-3">
              <div className="text-sm text-muted-foreground">
                {door.cbm > 0
                  ? `${door.cbm.toFixed(4)} CBM × $${door.rate} · se usa el mayor CBM (${door.source === 'medidas' ? 'por medidas' : 'indicado'})`
                  : 'Ingresa las medidas o el CBM para calcular la entrega.'}
              </div>
              <div className="font-display text-lg font-bold text-foreground">${door.charge.toFixed(2)}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}