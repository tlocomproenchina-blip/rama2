import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Lista compacta y desplazable para cada bloque del historial del cliente.
export default function AssistantHistoryList({ title, count, items, empty, renderItem }) {
  return (
    <div className="space-y-2">
      <p className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <span>{title}</span>
        {count ? <span className="text-foreground">{count}</span> : null}
      </p>
      {items.length > 0 ? (
        <ul className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
          {items.map((item, index) => (
            <li key={item.id || `${title}-${index}`} className="rounded-xl bg-muted/50 px-3 py-2 text-xs text-foreground">
              {renderItem(item)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}