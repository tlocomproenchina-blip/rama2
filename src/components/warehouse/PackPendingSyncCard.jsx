import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CloudOff, Loader2, RefreshCw } from 'lucide-react';

// Unidades (bultos y cajas) creadas en el dispositivo que todavía no llegaron al servidor.
export default function PackPendingSyncCard({ items = [], isSyncing, isOnline, onRetry }) {
  if (!items.length) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/40">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2 text-amber-700">
          <CloudOff className="h-4 w-4 shrink-0" />
          <p className="text-sm font-semibold">Unidades por sincronizar ({items.length})</p>
          {!isSyncing && isOnline && (
            <Button variant="ghost" size="sm" onClick={onRetry} className="ml-auto h-7 text-xs">
              <RefreshCw className="h-3 w-3" /> Reintentar
            </Button>
          )}
        </div>
        <ul className="space-y-1 max-h-32 overflow-y-auto">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-xs">
              {item.sync_status === 'syncing' ? (
                <Loader2 className="h-3 w-3 shrink-0 animate-spin text-blue-500" />
              ) : item.sync_status === 'error' ? (
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />
              ) : (
                <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400 animate-pulse" />
              )}
              <span className={`font-mono break-all ${
                item.sync_status === 'error' ? 'text-red-600' : 'text-slate-600'
              }`}>
                {item.label_code || 'Unidad'}
              </span>
              {item.type === 'caja' && (
                <span className="shrink-0 rounded-full border border-amber-300 px-1.5 text-[10px] text-amber-800">
                  caja
                </span>
              )}
              {item.sync_status === 'error' && (
                <span className="text-[10px] text-red-400 truncate ml-auto">{item.error_message}</span>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}