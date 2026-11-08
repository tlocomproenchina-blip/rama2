import React from 'react';
import { Input } from '@/components/ui/input';
import { Layers } from 'lucide-react';
import { palletSequence } from '@/lib/guidePallets';

// Paletas físicas recibidas por el transporte, anotadas a mano por cliente. Los
// bultos del cliente no cambian: siguen en la guía como contenido del cliente.
// clients: [{ key, client_name, shipping_mark, bultos }]
export default function GuidePalletsInputs({ clients, values, onChange }) {
  if (!clients?.length) return null;

  const setValue = (key, raw) => {
    const clean = String(raw).replace(/[^0-9]/g, '').slice(0, 3);
    onChange({ ...values, [key]: clean });
  };

  return (
    <div className="space-y-2 rounded-xl border border-border/70 bg-card p-3">
      <div className="flex items-start gap-2">
        <Layers className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div>
          <p className="text-xs font-semibold text-foreground">Paletas recibidas por el transporte</p>
          <p className="text-[11px] text-muted-foreground">
            Cuántos paquetes envueltos entrega cada cliente. Se imprimen en la misma guía junto a sus bultos.
          </p>
        </div>
      </div>
      {clients.map((client) => {
        const count = Math.floor(Number(values?.[client.key]) || 0);
        const mark = client.shipping_mark || '—';
        return (
          <div key={client.key} className="flex items-center gap-3 rounded-lg border border-border/60 p-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-800">{client.client_name || mark}</p>
              <p className="text-[11px] text-muted-foreground">
                Mark {mark} · {client.bultos || 0} bulto(s) de contenido
                {count > 0 ? ` · ${palletSequence(count)}` : ''}
              </p>
            </div>
            <Input
              inputMode="numeric"
              value={values?.[client.key] ?? ''}
              onChange={(event) => setValue(client.key, event.target.value)}
              placeholder="0"
              aria-label={`Paletas de ${client.client_name || mark}`}
              className="h-10 w-20 shrink-0 text-center"
            />
          </div>
        );
      })}
    </div>
  );
}