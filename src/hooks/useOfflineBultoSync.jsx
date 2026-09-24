import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { getAll, put, del, bulkPut } from '@/lib/offlineDb';

// Hook que gestiona la cola de bultos cerrados pendientes de sincronizar.
// - Al cerrar un bulto offline, se encola en IndexedDB (sync_queue).
// - Al detectar conexión (online/visibilitychange), procesa la cola en segundo plano.
// - Llama a syncBultoBatch por cada bulto, idempotente por local_bulto_id.
// - Expone: pendingBultos (lista de bultos en cola), enqueueClosedBulto, isSyncing.

export function useOfflineBultoSync() {
  const [pendingBultos, setPendingBultos] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const processingRef = useRef(false);

  // Cargar cola pendiente al montar
  useEffect(() => {
    (async () => {
      const queue = await getAll('sync_queue');
      setPendingBultos(queue);
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

  // Encolar un bulto cerrado para sincronización
  const enqueueClosedBulto = useCallback(async (bultoData) => {
    const queueItem = {
      id: bultoData.local_bulto_id || `sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ...bultoData,
      sync_status: 'pending',
      created_at: Date.now(),
    };
    await put('sync_queue', queueItem);
    setPendingBultos((prev) => [...prev, queueItem]);
    // Intentar procesar inmediatamente si hay internet
    processQueue();
    return queueItem;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Procesar la cola de bultos pendientes
  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    processingRef.current = true;
    setIsSyncing(true);
    try {
      const queue = await getAll('sync_queue');
      const pending = queue.filter((item) => (item.sync_status === 'pending' || item.sync_status === 'error') && !item.type);
      for (const item of pending) {
        // Marcar como syncing
        item.sync_status = 'syncing';
        await put('sync_queue', item);
        setPendingBultos((prev) =>
          prev.map((p) => (p.id === item.id ? { ...p, sync_status: 'syncing' } : p))
        );
        try {
          const res = await base44.functions.invoke('syncBultoBatch', {
            local_bulto_id: item.id,
            label_code: item.label_code,
            client_email: item.client_email,
            shipping_mark: item.shipping_mark,
            bulto_number: item.bulto_number,
            total_bultos: item.total_bultos,
            package_ids: item.package_ids || [],
            package_trackings: item.package_trackings || [],
            client_snapshot: item.client_snapshot || {},
            invoice_paid: item.invoice_paid || false,
            invoice_status: item.invoice_status || '',
            invoice_number: item.invoice_number || '',
            warehouse_id: item.warehouse_id || '',
            created_by: item.created_by || '',
            closed_at: item.closed_at || new Date().toISOString(),
          });
          if (res?.data?.success || res?.data?.already_exists) {
            // Enlazar el bulto local con el servidor: guardar server_bulto_id sin tocar label_code
            const serverBultoId = res?.data?.bulto?.id;
            if (serverBultoId) {
              try {
                const localBultos = await getAll('bultos');
                const localBulto = localBultos.find((b) => (b.local_bulto_id || b.id) === item.id);
                if (localBulto) {
                  await put('bultos', { ...localBulto, server_bulto_id: serverBultoId, synced: true });
                }
              } catch (_) {}
            }
            // Sincronización exitosa: remover de la cola
            await del('sync_queue', item.id);
            setPendingBultos((prev) => prev.filter((p) => p.id !== item.id));
          } else {
            // Error lógico: marcar para reintento
            item.sync_status = 'error';
            item.error_message = res?.data?.error || 'Error desconocido';
            await put('sync_queue', item);
            setPendingBultos((prev) =>
              prev.map((p) => (p.id === item.id ? { ...p, sync_status: 'error', error_message: item.error_message } : p))
            );
          }
        } catch (e) {
          // Error de red: marcar para reintento (se procesará al volver la conexión)
          item.sync_status = 'error';
          item.error_message = e?.message || 'Error de red';
          await put('sync_queue', item);
          setPendingBultos((prev) =>
            prev.map((p) => (p.id === item.id ? { ...p, sync_status: 'error', error_message: item.error_message } : p))
          );
          // Si es error de red, parar el procesamiento (los demás también fallarán)
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

  // Reintentar manualmente
  const retrySync = useCallback(() => processQueue(), [processQueue]);

  return {
    pendingBultos,
    isSyncing,
    isOnline,
    enqueueClosedBulto,
    retrySync,
  };
}