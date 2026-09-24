import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Loader2, WifiOff, CloudOff } from 'lucide-react';

/**
 * Badge visual que muestra el estado de sincronización offline.
 * - Sin conexión y sin pendientes: badge "Sin conexión"
 * - Items pendientes: badge "N pendientes de sync" (clickeable para reintentar)
 * - Sincronizando: badge con spinner
 * - Todo al día: no renderiza nada
 */
export default function OfflineSyncBadge({ pendingCount, isOnline, isSyncing, onRetry }) {
  if (!isOnline && pendingCount === 0) {
    return (
      <Badge variant="outline" className="gap-1.5 border-amber-200 bg-amber-50 text-amber-700">
        <WifiOff className="h-3 w-3" /> Sin conexión
      </Badge>
    );
  }
  if (pendingCount === 0) return null;
  return (
    <button onClick={onRetry} className="inline-flex">
      <Badge
        variant="outline"
        className={`gap-1.5 cursor-pointer hover:opacity-80 ${
          isSyncing
            ? 'border-blue-200 bg-blue-50 text-blue-700'
            : 'border-amber-200 bg-amber-50 text-amber-700'
        }`}
      >
        {isSyncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CloudOff className="h-3 w-3" />}
        {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''} de sync
      </Badge>
    </button>
  );
}