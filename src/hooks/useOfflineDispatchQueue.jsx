import { useCallback } from 'react';
import { enqueue, retryAll } from '@/lib/storeForward/engine';
import { useStoreForwardQueue } from '@/hooks/useStoreForwardQueue';

// Salidas de almacén sobre el Store and Forward de la bodega: cada salida aprobada se
// guarda en el teléfono y se entrega al servidor en segundo plano.

const isDispatch = (item) => item.type === 'dispatch' || item.type === 'bulto_dispatch';
const newId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export function useOfflineDispatchQueue() {
  const { items, isSyncing, isOnline } = useStoreForwardQueue(isDispatch);

  const enqueueDispatch = useCallback((d) => enqueue({
    id: d.local_id || newId('dispatch'),
    type: 'dispatch',
    tracking: d.tracking,
    package_id: d.package_id || null,
    photo_urls: d.photo_urls || [],
    client_email: d.client_email || '',
    client_name: d.client_name || '',
    shipping_mark: d.shipping_mark || '',
  }), []);

  const enqueueBultoDispatch = useCallback((b) => enqueue({
    id: b.local_id || newId('bulto_dispatch'),
    type: 'bulto_dispatch',
    label_code: b.label_code,
    bulto_id: b.bulto_id || null,
    client_email: b.client_email || '',
    client_name: b.client_name || '',
    shipping_mark: b.shipping_mark || '',
    package_count: b.package_count || 0,
    photo_urls: b.photo_urls || [],
  }), []);

  const retrySync = useCallback(() => retryAll(isDispatch), []);

  return { pendingDispatches: items, isSyncing, isOnline, enqueueDispatch, enqueueBultoDispatch, retrySync };
}