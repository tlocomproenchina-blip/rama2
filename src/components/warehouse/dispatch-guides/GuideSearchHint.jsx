import React from 'react';
import { Search } from 'lucide-react';

// Estado inicial de las pestañas de emisión manual: nada de información hasta que
// el admin haga una búsqueda.
export default function GuideSearchHint({ text }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-border/70 bg-secondary/40 p-3 text-xs text-slate-500">
      <Search className="h-4 w-4 shrink-0 text-slate-400" />
      <span>{text}</span>
    </div>
  );
}