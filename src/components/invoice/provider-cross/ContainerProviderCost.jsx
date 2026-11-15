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
      <span className="text-slate-700">Costo {money(r.total)}</span>
      <span className="text-success">Pagado {money(r.paid)}</span>
      <span className="font-semibold text-warning">Saldo {money(r.balance)}</span>
      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={(e) => { e.stopPropagation(); onOpen(r); }}>Documentos</Button>
    </div>
  ));
}