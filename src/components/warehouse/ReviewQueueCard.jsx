import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CloudUpload, Loader2, RefreshCw } from 'lucide-react';

// Revisiones guardadas en el dispositivo que todavía se están subiendo al servidor.
export default function ReviewQueueCard({ items = [], onRetry }) {
  if (!items.length) return null;
  const busy = items.some((i) => i.status === 'syncing');

  return (
    <Card className="border-sky-200 bg-sky-50/40">
      <CardContent className="space-y-2 p-3">
        <div className="flex items-center gap-2 text-sky-700">
          <CloudUpload className="h-4 w-4 shrink-0" />
          <p className="text-sm font-semibold">Revisiones subiendo ({items.length})</p>
          {!busy && (
            <Button variant="ghost" size="sm" onClick={onRetry} className="ml-auto h-7 text-xs">
              <RefreshCw className="h-3 w-3" /> Reintentar
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Quedan guardadas en este teléfono y se suben solas. Puedes seguir empacando.</p>
        <ul className="max-h-32 space-y-1 overflow-y-auto">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-xs">
              {item.status === 'syncing' ? (
                <Loader2 className="h-3 w-3 shrink-0 animate-spin text-sky-600" />
              ) : item.status === 'error' ? (
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />
              ) : (
                <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-sky-400" />
              )}
              <span className="break-all font-mono text-foreground">{item.payload?.tracking_number || 'Paquete'}</span>
              {item.status === 'error' && <span className="ml-auto truncate text-[10px] text-destructive">{item.error}</span>}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}