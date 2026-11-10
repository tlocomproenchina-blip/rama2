import React, { useEffect, useState } from 'react';
import { CloudOff, RotateCw, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { listOutbox, onOutboxChanged, retryOutboxItem, discardOutboxItem } from '@/lib/printOutbox';

// Trabajos guardados en este dispositivo que aún no confirma la cola compartida.
export default function PrintOutboxList() {
  const [items, setItems] = useState([]);
  const [busyKey, setBusyKey] = useState(null);
  useEffect(() => {
    const load = () => listOutbox().then(setItems).catch(() => {});
    load();
    return onOutboxChanged(load);
  }, []);
  if (!items.length) return null;

  const run = async (item, fn) => { setBusyKey(item.clientKey); await fn(item); setBusyKey(null); };
  return (
    <div className="space-y-2 rounded-xl border border-amber-300/60 bg-amber-50 p-3 dark:bg-amber-950/30">
      <p className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
        <CloudOff className="h-4 w-4" /> {items.length} pendiente(s) en este dispositivo · se reenvían solos al volver internet
      </p>
      {items.map((it) => (
        <div key={it.clientKey} className="flex items-center gap-2 rounded-lg bg-card px-2 py-1.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{it.title || 'Impresión'}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              Pendiente local · {it.attempts || 0} intento(s){it.lastError ? ` · ${it.lastError}` : ''}
            </p>
          </div>
          {busyKey === it.clientKey ? <Loader2 className="h-4 w-4 animate-spin" /> : (
            <>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => run(it, retryOutboxItem)}><RotateCw className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => run(it, discardOutboxItem)}><Trash2 className="h-4 w-4" /></Button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}