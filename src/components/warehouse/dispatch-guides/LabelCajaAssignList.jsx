import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ListOrdered } from 'lucide-react';

// Lista compacta de las etiquetas del rango: una fila por número con su X/N y el
// selector de la caja cuyo código de barras lleva esa etiqueta. La etiqueta que se
// queda sin caja elegida sale como antes, sin código de barras.
export default function LabelCajaAssignList({ labels, total, cajas, assign, onAssign, onAutoAssign }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground">Caja de cada etiqueta</Label>
        {cajas.length > 0 && (
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onAutoAssign}>
            <ListOrdered className="h-3.5 w-3.5" /> Asignar en orden
          </Button>
        )}
      </div>

      {!cajas.length ? (
        <p className="rounded-xl border border-border/70 bg-muted/40 p-2.5 text-[11px] text-muted-foreground">
          Este cliente no tiene cajas con código para pegar; las etiquetas saldrán sin código de
          barras.
        </p>
      ) : (
        <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
          {labels.map((number) => (
            <div
              key={number}
              className="flex items-center gap-2 rounded-xl border border-border/70 bg-card/70 px-2.5 py-1.5"
            >
              <span className="w-14 shrink-0 font-display text-sm font-bold text-foreground">
                {number}/{total}
              </span>
              <select
                value={assign[number] || ''}
                onChange={(e) => onAssign(number, e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-border/70 bg-card px-2 py-1.5 font-mono text-xs text-foreground"
              >
                <option value="">Sin código de barras</option>
                {cajas.map((caja) => (
                  <option key={caja.label_code} value={caja.label_code}>
                    {caja.label_code}
                    {caja.caja_number ? ` · ${caja.caja_number}/${caja.caja_total}` : ''}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}