import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Boxes, Loader2, Printer } from 'lucide-react';

// Cajas del cliente que siguen en almacén y todavía no salieron: es el lote que se
// identifica con la tira de etiquetas continuas (una etiqueta por caja) antes de
// despachar. Mientras no se imprima la tira, la caja no muestra su posición X/N.
export default function CajaLotList({ cajas = [], loading, onPrintLabels }) {
  if (!cajas.length) return null;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Boxes className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                Cajas en almacén de este cliente ({cajas.length})
              </p>
              <p className="text-[11px] text-muted-foreground">
                Imprime la tira continua numerada 1/{cajas.length} y pega una etiqueta en cada caja.
              </p>
            </div>
          </div>
          <Button size="sm" className="gap-2" onClick={onPrintLabels}>
            <Printer className="h-4 w-4" /> Etiquetas continuas
          </Button>
        </div>

        <div className="space-y-1.5">
          {cajas.map((caja) => (
            <div
              key={caja.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-card/70 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="font-mono text-sm text-foreground break-all">{caja.label_code}</p>
                <p className="text-[11px] text-muted-foreground">
                  {(caja.package_ids || []).length + (caja.unregistered_codes || []).length} paquete(s)
                  {Number(caja.cargo_cbm) > 0 ? ` · ${Number(caja.cargo_cbm).toFixed(3)} CBM` : ''}
                  {(caja.cbm_order_numbers || []).length
                    ? ` · orden ${caja.cbm_order_numbers.join(', ')}`
                    : ''}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {caja.caja_number ? (
                  <Badge variant="outline" className="border-primary/40 text-primary">
                    {caja.caja_number}/{caja.caja_total || cajas.length}
                  </Badge>
                ) : null}
                {caja.is_local ? (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" /> por sincronizar
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-emerald-300 text-[10px] text-emerald-700">
                    registrada
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}