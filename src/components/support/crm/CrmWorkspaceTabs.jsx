import React from 'react';
import { Inbox, PackageX } from 'lucide-react';

const TABS = [
  { id: 'bandeja', label: 'Bandeja', icon: Inbox },
  { id: 'huerfanos', label: 'Paquetes huérfanos', icon: PackageX },
];

// Navegación del espacio único de Soporte.
export default function CrmWorkspaceTabs({ value, onChange }) {
  return (
    <nav className="flex flex-wrap gap-1.5 rounded-2xl border border-border bg-card/70 p-1.5">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
            value === id ? 'bg-primary text-primary-foreground shadow-card' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          }`}
        >
          <Icon className="h-4 w-4" /> {label}
        </button>
      ))}
    </nav>
  );
}