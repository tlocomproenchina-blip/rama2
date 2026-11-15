import React from 'react';
import { Building2 } from 'lucide-react';

export default function WholesalerSourceList({ connections, value, onChange }) {
  const items = [{ key: 'todos', name: 'Todos los mayoristas' }, ...connections.map((c) => ({ key: c.config_key || 'main', name: c.wholesaler_name || 'Cliente mayorista' }))];
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-card space-y-3">
      <h2 className="font-display text-lg font-semibold border-b-2 border-primary pb-2">Mayoristas</h2>
      {items.map((it) => (
        <button
          key={it.key}
          onClick={() => onChange(it.key)}
          className={`w-full flex items-center gap-2 rounded-xl border border-l-4 px-3 py-3 text-left text-sm font-semibold transition-shadow hover:shadow-card ${value === it.key ? 'border-l-primary bg-accent text-accent-foreground' : 'border-l-border bg-card'}`}
        >
          <Building2 className="h-4 w-4 shrink-0" /> {it.name}
        </button>
      ))}
      <p className="text-xs text-muted-foreground">Los datos de cada mayorista se muestran por separado: no se mezclan con tus clientes ni paquetes propios.</p>
    </div>
  );
}