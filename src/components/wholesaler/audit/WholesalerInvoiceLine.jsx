import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { lineAmounts, money } from '@/lib/wholesalerScope';

export default function WholesalerInvoiceLine({ line, rates, onChange, onRemove }) {
  const a = lineAmounts(String(line.cbm).replace(',', '.'), line.packages, rates);
  const c = line.client;
  return (
    <div className="grid gap-3 rounded-2xl border border-l-4 border-l-primary bg-card p-4 shadow-card md:grid-cols-[1.4fr_0.6fr_0.6fr_1.4fr_auto] md:items-end">
      <div className="min-w-0">
        <p className="truncate font-semibold">{c.full_name || c.email}</p>
        <p className="truncate text-xs text-muted-foreground">{c.shipping_mark || 'sin mark'} · {c.email}</p>
      </div>
      <div className="space-y-1"><Label className="text-xs">CBM facturados</Label>
        <Input inputMode="decimal" value={line.cbm} onChange={(e) => onChange({ cbm: e.target.value })} placeholder="0.000" /></div>
      <div className="space-y-1"><Label className="text-xs">Paquetes</Label>
        <Input type="number" min="0" value={line.packages} onChange={(e) => onChange({ packages: e.target.value })} placeholder="0" /></div>
      <div className="text-xs text-muted-foreground">
        <p>Envío {money(a.shipping)} · Puerta a puerta {money(a.door)} · Manejo {money(a.handling)}</p>
        <p className="font-display text-base font-bold text-foreground">{money(a.total)}</p>
      </div>
      <Button size="icon" variant="ghost" onClick={onRemove} aria-label="Quitar"><X /></Button>
    </div>
  );
}