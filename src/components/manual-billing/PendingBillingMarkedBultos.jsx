import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle2, ChevronDown, Loader2 } from 'lucide-react';
import PendingBillingBultoRow from './PendingBillingBultoRow';

// Bultos ya facturados por fuera del sistema: salen de sus pestañas y se conservan
// aquí, en verde y agrupados por N° de orden, con su casilla para devolverlos —uno por
// uno o todo el envío de una sola vez.
export default function PendingBillingMarkedBultos({ bultos = [], markingId, onMarkBulto, onMarkOrderBultos }) {
  const [open, setOpen] = useState(false);
  const [busyOrder, setBusyOrder] = useState(null);

  const groups = useMemo(() => {
    const map = new Map();
    for (const bulto of bultos) {
      const order = String((bulto.order_numbers || [])[0] || '').trim();
      if (!map.has(order)) map.set(order, []);
      map.get(order).push(bulto);
    }
    return [...map.entries()].map(([order, items]) => ({ order, items }));
  }, [bultos]);

  const unmarkWholeOrder = async (group) => {
    if (busyOrder) return;
    setBusyOrder(group.order);
    await onMarkOrderBultos(group.items, false);
    setBusyOrder(null);
  };

  if (bultos.length === 0) return null;

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 p-3 text-left"
      >
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800">
          <CheckCircle2 className="h-4 w-4" /> Envíos ya facturados ({bultos.length})
        </span>
        <ChevronDown className={`h-4 w-4 text-emerald-700 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="space-y-2 px-3 pb-3">
          <p className="text-[11px] text-emerald-800/80">
            Ya se facturaron por fuera del sistema: no se ofrecen para facturar. Quita la marca de un bulto, o de todo el envío, para devolverlos a su N° de orden.
          </p>
          {groups.map((g) => (
            <div key={g.order || 'sin-orden'} className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <Badge className="min-w-0 bg-emerald-100 text-emerald-800 border border-emerald-300 break-all">
                  N° de orden {g.order || 'sin asignar'}
                </Badge>
                {g.order && (
                  <div className="shrink-0 flex flex-col items-center gap-0.5">
                    {busyOrder === g.order ? (
                      <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                    ) : (
                      <Checkbox
                        checked
                        onCheckedChange={() => unmarkWholeOrder(g)}
                        title="Devolver todo el envío a la carga pendiente"
                        aria-label="Devolver todo el envío a la carga pendiente"
                        className="border-emerald-600 data-[state=checked]:bg-emerald-600 data-[state=checked]:text-white"
                      />
                    )}
                    <span className="text-[10px] font-medium text-emerald-700">Facturado</span>
                  </div>
                )}
              </div>
              {g.items.map((bulto) => (
                <PendingBillingBultoRow
                  key={bulto.id}
                  bulto={bulto}
                  marking={markingId === bulto.id}
                  onMark={onMarkBulto}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}