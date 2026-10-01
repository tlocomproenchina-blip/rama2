import React from 'react';
import { Clock, Loader2, Package, Wifi, WifiOff } from 'lucide-react';

// Línea de estado del almacén: conexión, última sincronización, bloque de números de
// bulto reservado, pendientes de sincronizar y sincronización en curso.
export default function PackStatusBar({
  isOnline, lastSync, numberBlock, reservingBlock, pendingCount, isSyncing,
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-3 py-2 text-sm ${
        isOnline
          ? 'bg-green-50 text-green-700 border border-green-200'
          : 'bg-orange-50 text-orange-700 border border-orange-200'
      }`}
    >
      {isOnline ? <Wifi className="h-4 w-4 shrink-0" /> : <WifiOff className="h-4 w-4 shrink-0" />}
      <span>{isOnline ? 'En línea' : 'Sin conexión — modo offline'}</span>

      {lastSync && (
        <span className="flex items-center gap-1 text-xs text-slate-500">
          <Clock className="h-3 w-3" />
          Últ. sync: {new Date(lastSync).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}

      {numberBlock && (
        <span className="flex items-center gap-1 text-xs text-blue-700">
          <Package className="h-3.5 w-3.5 shrink-0" />
          Números de bulto: {numberBlock.next_number}–{numberBlock.end}
          {reservingBlock && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
        </span>
      )}

      {pendingCount > 0 && (
        <span className="ml-auto flex items-center gap-1 text-xs font-medium">
          <Clock className="h-3 w-3" /> {pendingCount} por sincronizar
        </span>
      )}

      {isSyncing && (
        <span className="ml-auto flex items-center gap-1 text-xs font-medium text-blue-600">
          <Loader2 className="h-3 w-3 animate-spin" /> Sincronizando…
        </span>
      )}
    </div>
  );
}