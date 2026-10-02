import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Check, Boxes } from 'lucide-react';

// Cajas del cliente que se marcan para armar el lote de etiquetas. Una caja que ya está
// dentro de una guía sale bloqueada con el número de esa guía: no vuelve a despacharse.
export default function CajaBatchList({ cajas, selected, onToggle, onToggleAll, disabled = false }) {
  const selectable = cajas.filter((caja) => !caja.in_guide);
  const allSelected = selectable.length > 0 && selected.length === selectable.length;

  if (!cajas.length) {
    return (
      <p className="rounded-xl border border-border/70 bg-muted/40 p-3 text-xs text-muted-foreground">
        Este cliente no tiene cajas pendientes de despacho.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {selected.length} de {selectable.length} caja(s) marcadas
        </p>
        {selectable.length > 0 && (
          <Button type="button" variant="outline" size="sm" onClick={onToggleAll} disabled={disabled}>
            <Boxes className="h-3.5 w-3.5" /> {allSelected ? 'Quitar todas' : 'Marcar todas'}
          </Button>
        )}
      </div>

      {cajas.map((caja) => {
        const checked = selected.includes(caja.label_code);
        return (
          <button
            key={caja.id || caja.label_code}
            type="button"
            disabled={disabled || caja.in_guide}
            onClick={() => onToggle(caja.label_code)}
            className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
              caja.in_guide
                ? 'border-border/60 bg-muted/40 opacity-75'
                : checked
                  ? 'border-primary/40 bg-accent'
                  : 'border-border/70 bg-card/70'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                  checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border/80'
                }`}
              >
                {checked && <Check className="h-3.5 w-3.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="font-mono text-sm font-semibold text-foreground break-all">
                    {caja.label_code}
                  </p>
                  {caja.caja_number ? (
                    <Badge variant="outline" className="font-display">
                      {caja.caja_number}/{caja.caja_total}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {caja.package_count} paquete(s) ·{' '}
                  {caja.cbm > 0 ? `${Number(caja.cbm).toFixed(3)} CBM` : 'sin CBM'}
                  {caja.status ? ` · ${caja.status}` : ''}
                </p>
                {caja.in_guide && (
                  <p className="mt-1 flex items-start gap-1 text-[11px] text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    Ya está en la guía {caja.guide_number || 'emitida'} — no entra en este lote
                  </p>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}