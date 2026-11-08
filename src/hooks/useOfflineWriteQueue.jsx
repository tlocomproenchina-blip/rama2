import { useCallback } from 'react';
import { discardItem, enqueue as enqueueEvent, retryAll } from '@/lib/storeForward/engine';
import { useStoreForwardQueue } from '@/hooks/useStoreForwardQueue';

// Cola de escrituras de una pantalla de bodega (recepción, ubicaciones, pick & pack,
// huérfanos, paquetes) sobre el Store and Forward. Qué hace el servidor con cada
// tipo vive en lib/storeForward/handlers.js, así se envía aunque la pantalla esté cerrada.
export function useOfflineWriteQueue({ queueType }) {
  const match = useCallback((item) => item.queue_type === queueType, [queueType]);
  const { items, isOnline, isSyncing } = useStoreForwardQueue(match);

  const enqueue = useCallback((item) => enqueueEvent({
    payload: {},
    ...item,
    queue_type: queueType,
  }), [queueType]);

  const retrySync = useCallback(() => retryAll(match), [match]);

  return { pending: items, isOnline, isSyncing, enqueue, removeItem: discardItem, retrySync };
}