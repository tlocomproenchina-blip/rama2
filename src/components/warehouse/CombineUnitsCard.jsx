import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Boxes, Combine, Loader2, Package, PackageOpen } from 'lucide-react';
import { realPackageCount } from '@/lib/bultoCounts';

// Combinar bultos y cajas de la mesa de empaque en una sola unidad nueva: se eligen las
// unidades abiertas del mismo cliente, se decide si la nueva es caja o bulto suelto y el
// sistema genera su código. Al cerrar la unidad nueva se imprime su etiqueta.
export default function CombineUnitsCard({ units = [], busy = false, onCombine }) {
  const [selected, setSelected] = useState([]);
  const [kind, setKind] = useState('caja');

  const open = useMemo(
    () => (units || []).filter((u) => u.status === 'activo' && !u.closed_at),
    [units]
  );

  // Una unidad que dejó de estar abierta sale de la selección.
  useEffect(() => {
    setSelected((prev) => prev.filter((id) => open.some((u) => u.id === id)));
  }, [open]);

  const chosen = open.filter((u) => selected.includes(u.id));
  const clients = new Set(chosen.map((u) => String(u.client_email || '').toLowerCase()));
  const mixedClients = clients.size > 1;
  const totalPackages = chosen.reduce((sum, u) => sum + realPackageCount(u), 0);
  const canCombine = chosen.length >= 2 && !mixedClients && !busy;

  const toggle = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleCombine = async () => {
    const done = await onCombine?.({ ids: selected, kind });
    if (done) setSelected([]);
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-2">
          <Combine className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Combinar bultos o cajas</p>
            <p className="text-xs text-muted-foreground">
              Une varias unidades del mismo cliente en una sola unidad nueva con su código.
            </p>
          </div>
        </div>

        {open.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
            <PackageOpen className="h-4 w-4 shrink-0" />
            No hay unidades abiertas en este dispositivo. Arma al menos dos bultos o cajas para poder combinarlos.
          </div>
        ) : (
          <div className="space-y-1.5">
            {open.map((unit) => {
              const count = realPackageCount(unit);
              const isSelected = selected.includes(unit.id);
              return (
                <label
                  key={unit.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 transition-colors ${
                    isSelected ? 'border-primary/50 bg-primary/5' : 'border-border/70 bg-card'
                  }`}
                >
                  <Checkbox checked={isSelected} onCheckedChange={() => toggle(unit.id)} disabled={busy} />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs font-semibold text-foreground break-all">
                      {unit.label_code}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {count} paquete(s) · {(unit.package_trackings || []).length} código(s)
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {unit.is_caja ? <Boxes className="mr-1 h-3 w-3" /> : <Package className="mr-1 h-3 w-3" />}
                    {unit.is_caja ? 'Caja' : 'Bulto'}
                  </Badge>
                </label>
              );
            })}
          </div>
        )}

        {open.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              La unidad nueva será
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setKind('caja')}
                disabled={busy}
                className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                  kind === 'caja' ? 'border-primary bg-primary/5' : 'border-border/70'
                }`}
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Boxes className="h-3.5 w-3.5" /> Caja consolidada
                </span>
                <span className="text-[11px] text-muted-foreground">Etiqueta continua -C##</span>
              </button>
              <button
                type="button"
                onClick={() => setKind('bulto')}
                disabled={busy}
                className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                  kind === 'bulto' ? 'border-primary bg-primary/5' : 'border-border/70'
                }`}
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Package className="h-3.5 w-3.5" /> Bulto suelto
                </span>
                <span className="text-[11px] text-muted-foreground">Etiqueta individual -B##</span>
              </button>
            </div>
          </div>
        )}

        {mixedClients && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Solo se pueden combinar unidades del mismo cliente.
          </p>
        )}

        {chosen.length > 0 && !mixedClients && (
          <p className="text-xs text-muted-foreground">
            {chosen.length} unidad(es) · {totalPackages} paquete(s) pasarán a la unidad nueva y las originales se eliminan.
          </p>
        )}

        <Button className="w-full gap-2" onClick={handleCombine} disabled={!canCombine}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Combine className="h-4 w-4" />}
          {chosen.length >= 2
            ? `Combinar ${chosen.length} en ${kind === 'caja' ? 'una caja nueva' : 'un bulto nuevo'}`
            : 'Elige al menos dos unidades'}
        </Button>
      </CardContent>
    </Card>
  );
}