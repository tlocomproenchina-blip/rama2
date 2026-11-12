import React, { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { computeTotals, money } from '@/lib/fiscalCalc';
import { blankLine } from '@/lib/fiscalForm';

const COLS = 'sm:grid-cols-[92px_1fr_132px_124px_40px]';

export default function FiscalLinesStep({ form, setForm, error }) {
  const { calc } = useMemo(() => computeTotals(form.lines), [form.lines]);
  const setLine = (k, patch) =>
    setForm((f) => ({ ...f, lines: f.lines.map((l) => (l._k === k ? { ...l, ...patch } : l)) }));
  const remove = (k) =>
    setForm((f) => {
      const lines = f.lines.filter((l) => l._k !== k);
      return { ...f, lines: lines.length ? lines : [blankLine()] };
    });
  const add = () => setForm((f) => ({ ...f, lines: [...f.lines, blankLine()] }));
  const noMinus = (v) => v.replace(/-/g, '');

  return (
    <div className="space-y-3">
      <div className={`hidden gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:grid ${COLS}`}>
        <span>Cantidad</span><span>Descripción</span><span>Precio unitario</span><span className="text-right">Total</span><span />
      </div>
      {form.lines.map((l, i) => (
        <div key={l._k} className={`grid gap-2 rounded-xl border border-border bg-card p-3 sm:items-center sm:border-0 sm:bg-transparent sm:p-0 ${COLS}`}>
          <div>
            <Label className="text-xs sm:hidden">Cantidad</Label>
            <Input type="number" inputMode="decimal" min="0" step="any" value={l.quantity} onChange={(e) => setLine(l._k, { quantity: noMinus(e.target.value) })} placeholder="0" aria-label={`Cantidad línea ${i + 1}`} />
          </div>
          <div>
            <Label className="text-xs sm:hidden">Descripción</Label>
            <Input value={l.description} onChange={(e) => setLine(l._k, { description: e.target.value })} maxLength={200} placeholder="Producto o servicio" aria-label={`Descripción línea ${i + 1}`} />
          </div>
          <div>
            <Label className="text-xs sm:hidden">Precio unitario</Label>
            <Input type="number" inputMode="decimal" min="0" step="0.01" value={l.unit_price} onChange={(e) => setLine(l._k, { unit_price: noMinus(e.target.value) })} placeholder="0,00" aria-label={`Precio unitario línea ${i + 1}`} />
          </div>
          <div className="flex items-center justify-between sm:justify-end">
            <span className="text-xs text-muted-foreground sm:hidden">Total</span>
            <span className="text-sm font-semibold tabular-nums text-foreground">{money(calc[i].totalCents / 100)}</span>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => remove(l._k)} aria-label={`Eliminar línea ${i + 1}`} className="text-muted-foreground hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
      <Button type="button" variant="outline" onClick={add}>
        <Plus className="h-4 w-4" /> Agregar línea
      </Button>
    </div>
  );
}