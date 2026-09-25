import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { put, getAll, del } from '@/lib/offlineDb';
import { toast } from 'sonner';

// Cola offline-first para salidas de almacén (despachos).
// - Al aprobar una salida, se encola en IndexedDB (sync_queue con type='dispatch').
// - Al detectar conexión, procesa la cola en segundo plano llamando scanDispatchPackage(action=dispatch).
// - Expone: pendingDispatches (lista), isSyncing, isOnline, enqueueDispatch, retrySync.

export function useOfflineDispatchQueue() {
  const [pendingDispatches, setPendingDispatches] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const processingRef = useRef(false);

  // Cargar cola pendiente al montar (solo items type='dispatch')
  useEffect(() => {
    (async () => {
      const queue = await getAll('sync_queue');
      setPendingDispatches(queue.filter((i) => i.type === 'dispatch'));
    })();
  }, []);

  // Escuchar cambios de conexión
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      processQueue();
    };
    const handleOffline = () => setIsOnline(false);
    const handleVisible = () => {
      if (!document.hidden && navigator.onLine) processQueue();
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisible);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisible);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Encolar una salida de almacén aprobada
  const enqueueDispatch = useCallback(async (dispatchData) => {
    const queueItem = {
      id: dispatchData.local_id || `dispatch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'dispatch',
      tracking: dispatchData.tracking,
      package_id: dispatchData.package_id || null,
      photo_urls: dispatchData.photo_urls || [],
      client_email: dispatchData.client_email || '',
      client_name: dispatchData.client_name || '',
      shipping_mark: dispatchData.shipping_mark || '',
      sync_status: 'pending',
      created_at: Date.now(),
    };
    await put('sync_queue', queueItem);
    setPendingDispatches((prev) => [...prev, queueItem]);
    processQueue();
    return queueItem;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Encolar el despacho de un bulto completo
  const enqueueBultoDispatch = useCallback(async (bultoData) => {
    const queueItem = {
      id: bultoData.local_id || `bulto_dispatch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'bulto_dispatch',
      label_code: bultoData.label_code,
      bulto_id: bultoData.bulto_id || null,
      client_email: bultoData.client_email || '',
      client_name: bultoData.client_name || '',
      shipping_mark: bultoData.shipping_mark || '',
      package_count: bultoData.package_count || 0,
      sync_status: 'pending',
      created_at: Date.now(),
    };
    await put('sync_queue', queueItem);
    setPendingDispatches((prev) => [...prev, queueItem]);
    processQueue();
    return queueItem;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Procesar la cola de despachos pendientes
  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    processingRef.current = true;
    setIsSyncing(true);
    try {
      const queue = await getAll('sync_queue');
      const pending = queue.filter((item) => (item.type === 'dispatch' || item.type === 'bulto_dispatch') && (item.sync_status === 'pending' || item.sync_status === 'error'));
        for (const item of pending) {
          item.sync_status = 'syncing';
          await put('sync_queue', item);
          setPendingDispatches((prev) =>
            prev.map((p) => (p.id === item.id ? { ...p, sync_status: 'syncing' } : p))
          );
          try {
            let res;
            if (item.type === 'bulto_dispatch') {
              // Despacho de bulto completo
              res = await base44.functions.invoke('dispatchBulto', {
                label_code: item.label_code,
              });
            } else {
              // Despacho de paquete individual
              const payload = { tracking_number: item.tracking, action: 'dispatch' };
              if (item.photo_urls?.length) {
                payload.package_image_url = item.photo_urls[0];
                payload.package_image_urls = item.photo_urls;
              }
              res = await base44.functions.invoke('scanDispatchPackage', payload);
            }
            const data = res?.data || res;
            if (data?.already_dispatched) {
              // Ya despachado por otro dispositivo: informar y remover de la cola
              toast.info(`Ya fue despachado en otro dispositivo: ${item.tracking || item.label_code || ''}`, { duration: 4000 });
              await del('sync_queue', item.id);
              setPendingDispatches((prev) => prev.filter((p) => p.id !== item.id));
            } else if (data?.package?.id || data?.success || data?.bulto) {
              // Sincronización exitosa: remover de la cola
              await del('sync_queue', item.id);
              setPendingDispatches((prev) => prev.filter((p) => p.id !== item.id));
            } else {
              item.sync_status = 'error';
              item.error_message = data?.error || 'Error desconocido';
              await put('sync_queue', item);
              setPendingDispatches((prev) =>
                prev.map((p) => (p.id === item.id ? { ...p, sync_status: 'error', error_message: item.error_message } : p))
              );
            }
          } catch (e) {
          item.sync_status = 'error';
          item.error_message = e?.message || 'Error de red';
          await put('sync_queue', item);
          setPendingDispatches((prev) =>
            prev.map((p) => (p.id === item.id ? { ...p, sync_status: 'error', error_message: item.error_message } : p))
          );
          // Si es error de red, parar (los demás también fallarán)
          if (e?.message?.includes('429') || e?.message?.includes('network') || e?.message?.includes('fetch')) {
            break;
          }
        }
      }
    } finally {
      processingRef.current = false;
      setIsSyncing(false);
    }
  }, []);

  const retrySync = useCallback(() => processQueue(), [processQueue]);

  return {
    pendingDispatches,
    isSyncing,
    isOnline,
    enqueueDispatch,
    enqueueBultoDispatch,
    retrySync,
  };
}