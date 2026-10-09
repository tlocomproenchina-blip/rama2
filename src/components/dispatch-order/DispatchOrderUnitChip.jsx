import React from 'react';
import { Boxes, Package } from 'lucide-react';

// Una unidad que el almacén debe buscar: una caja consolidada o un bulto suelto.
export default function DispatchOrderUnitChip({ unit }) {
  const isCaja = unit.kind === 'caja';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium ${
        isCaja
          ? 'border-sky-200 bg-sky-50 text-sky-800'
          : 'border-slate-200 bg-slate-50 text-slate-700'
      }`}
    >
      {isCaja ? <Boxes className="h-3 w-3" /> : <Package className="h-3 w-3" />}
      {unit.code}
      {unit.caja_index ? ` · ${unit.caja_index}` : ''}
    </span>
  );
}