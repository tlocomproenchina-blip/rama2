import React from 'react';
import { Badge } from '@/components/ui/badge';

export default function Client360Section({ icon: Icon, title, count, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
        <Icon className="h-4 w-4 text-blue-600" />
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        <Badge variant="secondary" className="ml-auto">{count}</Badge>
      </div>
      <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
        {count === 0 ? (
          <p className="px-3 py-3 text-xs text-slate-400">Sin resultados</p>
        ) : children}
      </div>
    </div>
  );
}