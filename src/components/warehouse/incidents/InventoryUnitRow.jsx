import React from 'react';
import { Badge } from '@/components/ui/badge';

const RESULT = {
  recibida: { label: 'Revisada', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  recibida_con_incidencia: { label: 'Con incidencia', cls: 'border-red-200 bg-red-50 text-red-700' },
};

// Caja del cliente con su contenido declarado; se toca para elegirla en la revisión.
export default function InventoryUnitRow({ unit, selected, onSelect }) {
  const result = unit.review ? RESULT[unit.review.result] : null;
  return (
    <button type="button" onClick={onSelect}
      className={`w-full space-y-2 rounded-2xl border p-3 text-left transition-colors ${selected ? 'border-primary bg-accent' : 'border-border/70 bg-card'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-medium">{unit.label_code}</span>
        <Badge variant="outline" className="text-xs">{unit.is_caja ? 'Caja' : 'Bulto'}</Badge>
        {result ? <Badge variant="outline" className={`text-xs ${result.cls}`}>{result.label}</Badge> : <Badge variant="outline" className="text-xs">Sin revisar</Badge>}
        <span className="ml-auto text-xs text-muted-foreground">{unit.package_count} paquete(s)</span>
      </div>
      <ul className="space-y-1 text-xs">
        {unit.packages.map((p) => (
          <li key={p.tracking} className="rounded-lg bg-muted/60 px-2 py-1.5">
            <span className="font-mono">{p.tracking}</span> · {p.description || 'Sin descripción'}{p.package_count > 1 ? ` · ${p.package_count} uds` : ''}
          </li>
        ))}
        {unit.unregistered_codes.map((c) => <li key={c} className="rounded-lg bg-muted/60 px-2 py-1.5 font-mono">{c} · sin registro</li>)}
        {!unit.packages.length && !unit.unregistered_codes.length && <li className="text-muted-foreground">Sin contenido declarado</li>}
      </ul>
    </button>
  );
}