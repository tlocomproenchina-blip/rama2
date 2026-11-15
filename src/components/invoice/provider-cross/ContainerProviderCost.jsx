import React from 'react';
import { Button } from '@/components/ui/button';
import { money } from '@/lib/numbers';

// Costo, pagado y saldo del proveedor para un contenedor de la factura.
export default function ContainerProviderCost({ rows, loading, onOpen }) {
  if (loading) return <p className="pl-3 text-xs text-slate-400">Cargando costos del proveedor…</p>;
  if (!rows.length) return <p className="pl-3 text-xs text-slate-400">Sin factura de proveedor vinculada</p>;
  return rows.map((r) => (
    <div key={r.id} className="ml-3 flex flex-wrap items-center justify-end gap-x-4 gap-y-1 border-l-2 border-primary/30 pl-3 text-xs">
      <span className="mr-auto text-slate-500">Proveedor{r.shared_container ? ` · compartido (${r.shared_container})` : ''}</span>
      <span className="font-semibold text-slate-800">Costo total {money(r.total)}</span>
      {r.status === 'pagada' || r.balance <= 0
        ? <span className="rounded-full bg-success-bg px-2 py-0.5 font-semibold text-success">Pagado</span>
        : <span className="rounded-full bg-warning-bg px-2 py-0.5 font-semibold text-warning">Pendiente</span>}
      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={(e) => { e.stopPropagation(); onOpen(r); }}>Documentos</Button>
    </div>
  ));
}