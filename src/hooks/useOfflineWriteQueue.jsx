import { useState, useEffect, useCallback, useRef } from 'react';
import { put, getAll, del } from '@/lib/offlineDb';

/**
 * Hook genérico para una cola de escrituras offline-first.
 * - Encola operaciones en IndexedDB (sync_queue) con un queue_type específico.
 * - Al detectar conexión, procesa la cola en segundo plano llamando al `processor`.
 * - Expone: pending (items encolados), isOnline, isSyncing, enqueue, removeItem, retrySync.
 *
 * @param {string} queueType - Filtro para distinguir items de esta cola en sync_queue
 * @param {function} processor - Función async(item) que ejecuta la operación en el servidor
 * @returns { pending, isOnline, isSyncing, enqueue, removeItem, retrySync }
 */
export function useOfflineWriteQueue({ queueType, processor }) {
  const [pending, setPending] = useState([]);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const processingRef = useRef(false);
  const processorRef = useRef(processor);

  useEffect(() => {
    processorRef.current = processor;
  }, [processor]);

  // Cargar items pendientes al montar
  useEffect(() => {
    (async () => {
      const queue = await getAll('sync_queue');
      setPending(queue.filter((item) => item.queue_type === queueType));
    })();
  }, [queueType]);

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    processingRef.current = true;
    setIsSyncing(true);
    try {
      const queue = await getAll('sync_queue');
      const items = queue.filter(
        (item) =>
          item.queue_type === queueType &&
          (item.sync_status === 'pending' || item.sync_status === 'error')
      );
      for (const item of items) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) break;
        item.sync_status = 'syncing';
        await put('sync_queue', item);
        setPending((prev) =>
          prev.map((p) => (p.id === item.id ? { ...p, sync_status: 'syncing' } : p))
        );
        try {
          await processorRef.current(item);
          await del('sync_queue', item.id);
          setPending((prev) => prev.filter((p) => p.id !== item.id));
        } catch (e) {
          item.sync_status = 'error';
          item.error_message = e?.message || 'Error de red';
          await put('sync_queue', item);
          setPending((prev) =>
            prev.map((p) =>
              p.id === item.id
                ? { ...p, sync_status: 'error', error_message: item.error_message }
                : p
            )
          );
          // Si es error de red, parar (los demás también fallarán)
          if (
            e?.message?.includes('429') ||
            e?.message?.includes('network') ||
            e?.message?.includes('fetch') ||
            e?.message?.includes('CIRCUIT_BREAKER')
          ) {
            break;
          }
        }
      }
    } finally {
      processingRef.current = false;
      setIsSyncing(false);
    }
  }, [queueType]);

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
  }, [processQueue]);

  // Auto-procesar al montar y cada 30s si hay items pendientes
  useEffect(() => {
    if (typeof navigator === 'undefined' || navigator.onLine) processQueue();
    const interval = setInterval(() => {
      if (typeof navigator === 'undefined' || navigator.onLine) processQueue();
    }, 30000);
    return () => clearInterval(interval);
  }, [processQueue]);

  const enqueue = useCallback(
    async (item) => {
      const queueItem = {
        id: item.id || `${queueType}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        queue_type: queueType,
        payload: item.payload || {},
        sync_status: 'pending',
        created_at: Date.now(),
        ...item,
      };
      await put('sync_queue', queueItem);
      setPending((prev) => [...prev, queueItem]);
      processQueue();
      return queueItem;
    },
    [queueType, processQueue]
  );

  const removeItem = useCallback(async (id) => {
    await del('sync_queue', id);
    setPending((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const retrySync = useCallback(() => processQueue(), [processQueue]);

  return { pending, isOnline, isSyncing, enqueue, removeItem, retrySync };
}