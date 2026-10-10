import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';

// Crear un N° de orden/envío nuevo para el cliente al momento de facturarlo.
// Los trackings recibidos que aún no están en ninguna orden se pueden enganchar
// aquí, para que su manejo de 1 USD entre en la misma factura.
export default function WholesalerBillingNewOrderForm({ available, onAdd }) {
  const [open, setOpen] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [cbm, setCbm] = useState('');
  const [bultos, setBultos] = useState('');
  const [picked, setPicked] = useState([]);
  const [query, setQuery] = useState('');

  // Los bultos que se cobran son los trackings que se enganchen a la orden; el
  // campo acompaña ese conteo mientras el admin no escriba uno propio.
  const togglePick = (value) => {
    const next = picked.includes(value) ? picked.filter((item) => item !== value) : [...picked, value];
    if (bultos === '' || Number(bultos) === picked.length) setBultos(String(next.length));
    setPicked(next);
  };

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return available || [];
    return (available || []).filter((item) => String(item.tracking_number || '').toLowerCase().includes(needle));
  }, [available, query]);

  const submit = () => {
    const value = orderNumber.trim();
    if (!value) return;
    const bultosValue = bultos === '' ? picked.length : Math.max(Number(bultos) || 0, 0);
    onAdd({ order_number: value, cbm: Number(cbm) || 0, bultos: bultosValue, trackings: picked });
    setOrderNumber('');
    setCbm('');
    setBultos('');
    setPicked([]);
    setQuery('');
    setOpen(false);
  };

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Crear N° de orden
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">Nueva orden / envío</p>
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setOpen(false)} aria-label="Cerrar">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[10rem] flex-1">
          <label className="mb-1 block text-xs text-muted-foreground">N° de orden / envío</label>
          <Input value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} placeholder="Ej: 2026-0148" />
        </div>
        <div className="w-28">
          <label className="mb-1 block text-xs text-muted-foreground">CBM</label>
          <Input type="number" min="0" step="0.001" inputMode="decimal" value={cbm} onChange={(event) => setCbm(event.target.value)} />
        </div>
        <div className="w-32">
          <label className="mb-1 block text-xs text-muted-foreground">Cantidad de bultos</label>
          <Input
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={bultos}
            onChange={(event) => setBultos(event.target.value)}
            placeholder={String(picked.length)}
          />
        </div>
      </div>

      {(available || []).length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Trackings recibidos sin orden ({picked.length} elegido(s) de {available.length})
            </p>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filtrar tracking"
              className="h-9 w-full sm:w-52"
            />
          </div>
          <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
            {rows.map((item) => {
              const value = item.tracking_number;
              const checked = picked.includes(value);
              return (
                <label key={value} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/60 px-3 py-2">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => togglePick(value)}
                  />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{value}</span>
                  {item.description && (
                    <Badge variant="outline" className="shrink-0">{String(item.description).slice(0, 18)}</Badge>
                  )}
                </label>
              );
            })}
            {!rows.length && <p className="py-2 text-xs text-muted-foreground">No hay trackings que coincidan.</p>}
          </div>
        </div>
      )}

      <Button size="sm" onClick={submit} disabled={!orderNumber.trim()}>
        Agregar orden a la factura
      </Button>
    </div>
  );
}