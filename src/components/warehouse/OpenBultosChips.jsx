import React from 'react';
import { Package } from 'lucide-react';

// Mini-lista de bultos abiertos en paralelo, como chips colapsables.
// El operario toca uno para ponerlo como bulto activo destacado.
export default function OpenBultosChips({ bultos, activeId, onSelect }) {
  if (!bultos.length) return null;

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Bultos abiertos ({bultos.length})
      </p>
      <div className="flex flex-wrap gap-2">
        {bultos.map((b) => {
          const count = b.package_ids?.length || b.package_trackings?.length || 0;
          const isActive = b.id === activeId;
          return (
            <button
              key={b.id}
              onClick={() => onSelect(b.id)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? 'border-blue-500 bg-blue-600 text-white shadow-sm'
                  : 'border-border bg-card text-slate-700 hover:bg-accent'
              }`}
            >
              <Package className="h-3.5 w-3.5" />
              <span className="font-mono">{b.label_code || b.shipping_mark || b.client_email}</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                isActive ? 'bg-white/25 text-white' : 'bg-blue-100 text-blue-700'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}