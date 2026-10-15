import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, ChevronDown } from 'lucide-react';
import BilledReceiptRow from './BilledReceiptRow';

// Envíos ya facturados por fuera del sistema: se conservan (no se borran), agrupados
// por N° de contenedor en una sección plegable al final de la lista.
export default function BilledReceiptsSection({ receipts = [], markingId, onUnmark }) {
  const [open, setOpen] = useState(false);

  const groups = useMemo(() => {
    const map = new Map();
    for (const r of receipts) {
      const key = r.order || 'Sin N° de contenedor';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
    return [...map.entries()].map(([order, items]) => ({ order, items }));
  }, [receipts]);

  if (receipts.length === 0) return null;

  return (
    <Card className="border border-emerald-200 bg-emerald-50/40">
      <CardContent className="p-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 p-4 text-left"
        >
          <span className="inline-flex items-center gap-2 font-semibold text-emerald-800">
            <CheckCircle2 className="h-4 w-4" /> Recibos ya facturados ({receipts.length})
          </span>
          <ChevronDown className={`h-4 w-4 text-emerald-700 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="space-y-3 px-4 pb-4">
            <p className="text-[11px] text-emerald-800/80">
              Ya se facturaron por fuera del sistema: no suman en la factura. Desmarca uno para devolverlo a la lista facturable.
            </p>

            {groups.map((g) => (
              <div key={g.order} className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300">
                    N° de contenedor {g.order}
                  </Badge>
                  <span className="text-[11px] text-emerald-800/80">{g.items.length} envío(s)</span>
                </div>
                {g.items.map((r) => (
                  <BilledReceiptRow
                    key={r.id}
                    receipt={r}
                    marking={markingId === r.id}
                    onUnmark={onUnmark}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}