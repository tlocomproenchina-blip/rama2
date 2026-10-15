import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ChevronDown, ChevronUp, Layers, X } from 'lucide-react';

// Una contenedor del cliente dentro de la factura: sus bultos (que es lo que se
// cobra), su CBM de referencia y sus trackings recibidos (cada uno cobra 1 USD de
// manejo). Desde aquí también se pueden enganchar los trackings recibidos que aún
// no tienen contenedor.
export default function WholesalerBillingOrderRow({ order, onChange, onRemove, options }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const picked = order.picked || [];
  const bultos = Number(order.bultos) || 0;
  const received = (Number(order.received) || 0) + picked.length;
  const trackingsCount = (Number(order.trackings_count) || 0) + picked.length;

  const list = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const all = options || [];
    return needle ? all.filter((tracking) => tracking.toLowerCase().includes(needle)) : all;
  }, [options, query]);

  // Enganchar un tracking recibido suma un bulto al conteo del contenedor.
  const toggle = (tracking) => {
    const next = picked.includes(tracking)
      ? picked.filter((value) => value !== tracking)
      : [...picked, tracking];
    const base = Math.max(bultos - picked.length, 0);
    onChange({ picked: next, bultos: base + next.length });
  };

  return (
    <div className="rounded-xl border border-border/70 bg-card p-3">
      <div className="flex flex-wrap items-center gap-3">
        <Checkbox checked={order.checked !== false} onCheckedChange={(value) => onChange({ checked: !!value })} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-sm text-foreground">{order.order_number}</p>
          <p className="text-xs text-muted-foreground">
            {bultos} bulto(s) · {trackingsCount} tracking(s) · {received} recibido(s)
            {picked.length ? ` · ${picked.length} enganchado(s) aquí` : ''}
          </p>
        </div>
        {order.is_new && <Badge variant="secondary">Contenedor nuevo</Badge>}
        {(options || []).length > 0 && (
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => setOpen((value) => !value)}>
            <Layers className="h-3.5 w-3.5" />
            Trackings
            {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        )}
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={order.bultos}
            onChange={(event) => onChange({ bultos: event.target.value })}
            className="w-20"
          />
          <span className="text-xs text-muted-foreground">Bultos</span>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min="0"
            step="0.001"
            inputMode="decimal"
            value={order.cbm}
            onChange={(event) => onChange({ cbm: event.target.value })}
            className="w-24"
          />
          <span className="text-xs text-muted-foreground">CBM</span>
        </div>
        {onRemove && (
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onRemove} aria-label="Quitar contenedor">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {open && (
        <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Trackings recibidos sin contenedor: marca los que entran en esta factura
            </p>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filtrar tracking"
              className="h-9 w-full sm:w-48"
            />
          </div>
          <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
            {list.map((tracking) => (
              <label key={tracking} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/60 px-3 py-2">
                <Checkbox checked={picked.includes(tracking)} onCheckedChange={() => toggle(tracking)} />
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{tracking}</span>
              </label>
            ))}
            {!list.length && (
              <p className="py-2 text-xs text-muted-foreground">No hay trackings libres para enganchar.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}