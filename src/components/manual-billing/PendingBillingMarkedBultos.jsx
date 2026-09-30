import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, ChevronDown } from 'lucide-react';
import PendingBillingBultoRow from './PendingBillingBultoRow';

// Bultos ya facturados por fuera del sistema: salen de sus pestañas y se conservan
// aquí, en verde y agrupados por N° de orden, con su casilla para devolverlos.
export default function PendingBillingMarkedBultos({ bultos = [], markingId, onMarkBulto }) {
  const [open, setOpen] = useState(false);

  const groups = useMemo(() => {
    const map = new Map();
    for (const bulto of bultos) {
      const order = String((bulto.order_numbers || [])[0] || '').trim();
      if (!map.has(order)) map.set(order, []);
      map.get(order).push(bulto);
    }
    return [...map.entries()].map(([order, items]) => ({ order, items }));
  }, [bultos]);

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
            Ya se facturaron por fuera del sistema: no se ofrecen para facturar. Quita la marca de un bulto para devolverlo a su N° de orden.
          </p>
          {groups.map((g) => (
            <div key={g.order || 'sin-orden'} className="space-y-2">
              <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300">
                N° de orden {g.order || 'sin asignar'}
              </Badge>
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