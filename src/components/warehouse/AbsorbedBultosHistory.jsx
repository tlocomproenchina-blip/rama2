import React from 'react';
import { ArrowRightLeft } from 'lucide-react';

// Historial de bultos que este bulto fusionó (eliminados o conservados sin el paquete
// movido): deja ver el trabajo que ya venía hecho sin tener que rehacerlo.
export default function AbsorbedBultosHistory({ entries = [] }) {
  const list = (entries || []).filter(Boolean);
  if (!list.length) return null;

  return (
    <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
      <p className="flex items-center gap-2 text-xs font-medium text-slate-700">
        <ArrowRightLeft className="h-3.5 w-3.5" /> Bultos fusionados ({list.length})
      </p>
      <ul className="space-y-1 text-[11px] text-slate-600">
        {list.map((entry, index) => (
          <li key={index} className="flex flex-wrap gap-x-2">
            <span className="font-mono text-slate-800 break-all">
              {entry.label_code || 'sin etiqueta'}
            </span>
            <span>{entry.package_count || 0} paquete(s)</span>
            {entry.order_numbers?.length ? <span>N° {entry.order_numbers.join(', ')}</span> : null}
            {entry.absorbed_at ? <span>{new Date(entry.absorbed_at).toLocaleString('es-VE')}</span> : null}
            {entry.absorbed_by ? <span>por {entry.absorbed_by}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}