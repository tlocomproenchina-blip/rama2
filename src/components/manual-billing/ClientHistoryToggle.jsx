import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

// Secciones secundarias del cliente, plegadas para no recargar la vista principal.
export default function ClientHistoryToggle({ count = 0, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-border bg-card">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground">
        <span>Otros registros del cliente{count > 0 ? ` (${count})` : ''}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="space-y-4 border-t border-border p-4">{children}</div>}
    </div>
  );
}