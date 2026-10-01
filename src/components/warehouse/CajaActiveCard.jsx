import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowRightLeft, Boxes, CheckCircle2, Loader2, Package, Trash2 } from 'lucide-react';

// Caja consolidada abierta en el almacén: su código, lo que lleva dentro (paquetes,
// CBM y N° de orden), los bultos pequeños que absorbió y el cierre del bloque.
export default function CajaActiveCard({
  caja, contents, ordersText, onOrdersChange, onClose, onRemoveUnregistered, onRemoveAbsorbed, busy,
}) {
  const absorbed = Array.isArray(caja?.absorbed_bultos) ? caja.absorbed_bultos : [];
  const unregistered = Array.isArray(caja?.unregistered_codes) ? caja.unregistered_codes : [];
  const packageCount = contents?.package_count || 0;
  const cbm = Number(contents?.cbm) || 0;

  return (
    <Card className="border-primary/40">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Caja en armado
            </p>
            <p className="font-mono text-base font-bold text-foreground break-all">{caja?.label_code}</p>
            <p className="text-xs text-muted-foreground break-all">
              {caja?.client_snapshot?.full_name || caja?.client_email} · Mark {caja?.shipping_mark || '—'}
            </p>
          </div>
          <Badge variant="outline" className="border-primary/40 text-primary">
            <Boxes className="mr-1 h-3.5 w-3.5" /> {packageCount} paquete(s)
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl border border-border/70 bg-muted/40 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Paquetes dentro</p>
            <p className="font-semibold text-foreground">{packageCount}</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/40 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">CBM real</p>
            <p className="font-semibold text-foreground">{cbm > 0 ? cbm.toFixed(3) : '—'}</p>
          </div>
        </div>

        {absorbed.length > 0 && (
          <div className="space-y-1.5 rounded-xl border border-border/70 bg-card p-3">
            <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <ArrowRightLeft className="h-3.5 w-3.5" /> Bultos absorbidos ({absorbed.length})
            </p>
            {absorbed.map((entry, index) => (
              <div key={`${entry.label_code}-${index}`} className="flex items-start justify-between gap-2 text-xs">
                <span className="font-mono break-all text-foreground">
                  {entry.label_code || 'sin etiqueta'} · {entry.package_count || 0} paq.
                </span>
                {onRemoveAbsorbed && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 shrink-0 px-1 text-destructive"
                    onClick={() => onRemoveAbsorbed(index)}
                    disabled={busy}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">
              Al cerrar la caja, esos bultos se eliminan y su contenido queda dentro de ella.
            </p>
          </div>
        )}

        {unregistered.length > 0 && (
          <div className="space-y-1.5 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
            <p className="flex items-center gap-2 text-xs font-semibold text-amber-800">
              <Package className="h-3.5 w-3.5" /> Códigos sin registrar ({unregistered.length})
            </p>
            {unregistered.map((code) => (
              <div key={code} className="flex items-start justify-between gap-2 text-xs">
                <span className="font-mono break-all text-amber-900">{code}</span>
                {onRemoveUnregistered && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 shrink-0 px-1 text-destructive"
                    onClick={() => onRemoveUnregistered(code)}
                    disabled={busy}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">N° de orden del lote</Label>
          <Input
            value={ordersText}
            onChange={(e) => onOrdersChange(e.target.value)}
            placeholder="Ej: 12345, 12346"
            inputMode="numeric"
          />
          <p className="text-[11px] text-muted-foreground">
            Se suman los N° de orden de los bultos absorbidos. La caja no se cierra sin al menos uno.
          </p>
        </div>

        <Button className="w-full gap-2" onClick={onClose} disabled={busy || packageCount === 0}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Cerrar caja y sincronizar
        </Button>
      </CardContent>
    </Card>
  );
}