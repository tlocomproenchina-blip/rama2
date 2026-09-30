import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { getAll, put, del, bulkPut } from '@/lib/offlineDb';
import { toast } from 'sonner';

// Hook que gestiona la cola de escrituras offline pendientes de sincronizar.
// - Al cerrar un bulto offline, se encola en IndexedDB (sync_queue).
// - Al marcar un paquete como recibido offline, se encola (type='package_reception').
// - Al detectar conexión (online/visibilitychange), procesa la cola en segundo plano.
// - Llama a syncBultoBatch para bultos, y Package.update para recepción de paquetes.
// - Idempotente por id (local_bulto_id o package_id).
// - Expone: pendingBultos, enqueueClosedBulto, enqueuePackageReception, isSyncing.

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
      type: 'bulto',
      sync_status: 'pending',
      created_at: Date.now(),
    };
    await put('sync_queue', queueItem);
    setPendingBultos((prev) => [...prev, queueItem]);
    processQueue();
    return queueItem;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Encolar una recepción de paquete (Package.update status='recibido')
  const enqueuePackageReception = useCallback(async (pkg) => {
    if (!pkg?.id) return null;
    const queueItem = {
      id: `pkg_${pkg.id}`,
      type: 'package_reception',
      package_id: pkg.id,
      tracking_number: pkg.tracking_number || '',
      status: 'recibido',
      received_date: pkg.received_date || new Date().toISOString(),
      received_by: pkg.received_by || '',
      package_image_url: pkg.package_image_url || '',
      package_image_urls: Array.isArray(pkg.package_image_urls) ? pkg.package_image_urls : [],
      sync_status: 'pending',
      created_at: Date.now(),
    };
    await put('sync_queue', queueItem);
    setPendingBultos((prev) => [...prev, queueItem]);
    processQueue();
    return queueItem;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Procesar la cola de items pendientes
  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    processingRef.current = true;
    setIsSyncing(true);
    try {
      const queue = await getAll('sync_queue');
      const pending = queue.filter((item) => item.sync_status === 'pending' || item.sync_status === 'error');
      for (const item of pending) {
        // Marcar como syncing
        item.sync_status = 'syncing';
        await put('sync_queue', item);
        setPendingBultos((prev) =>
          prev.map((p) => (p.id === item.id ? { ...p, sync_status: 'syncing' } : p))
        );
        try {
          if (item.type === 'package_reception') {
            // Sincronizar recepción de paquete
            // Las fotos del escaneo viajan en la misma actualización de recepción.
            const photoFields = (item.package_image_urls && item.package_image_urls.length)
              ? {
                  package_image_url: item.package_image_url || item.package_image_urls[0],
                  package_image_urls: item.package_image_urls,
                }
              : {};
            const res = await base44.entities.Package.update(item.package_id, {
              status: item.status,
              received_date: item.received_date,
              received_by: item.received_by,
              ...photoFields,
            });
            // Detectar si el paquete ya fue recibido por otro dispositivo
            if (res?.already_received) {
              toast.info(`Paquete ${item.tracking_number || ''} ya fue recibido en otro dispositivo`, { duration: 4000 });
            }
          } else {
            // Sincronizar bulto cerrado (default)
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
              cbm_order_numbers: item.cbm_order_numbers || [],
              warehouse_id: item.warehouse_id || '',
              created_by: item.created_by || '',
              closed_at: item.closed_at || new Date().toISOString(),
            });
            if (!res?.data?.success && !res?.data?.already_exists) {
              throw new Error(res?.data?.error || 'Error desconocido');
            }
            // Detectar si el bulto ya fue cerrado/despachado por otro dispositivo
            if (res?.data?.already_closed || res?.data?.already_dispatched) {
              toast.info(`Bulto ${item.label_code || ''} ya fue procesado en otro dispositivo`, { duration: 4000 });
            }
            // Enlazar el bulto local con el servidor
            const serverBultoId = res?.data?.bulto?.id;
            if (serverBultoId) {
              try {
                const localBultos = await getAll('bultos');
                const localBulto = localBultos.find((b) => (b.local_bulto_id || b.id) === item.id);
                if (localBulto) {
                  // 'already_exists' significa que ese código ya estaba usado en el
                  // sistema: la etiqueta nueva no se registró y la pantalla lo avisa.
                  await put('bultos', {
                    ...localBulto,
                    server_bulto_id: serverBultoId,
                    synced: true,
                    sync_duplicate: !!res?.data?.already_exists,
                  });
                }
              } catch (_) {}
            }
          }
          // Sincronización exitosa: remover de la cola
          await del('sync_queue', item.id);
          setPendingBultos((prev) => prev.filter((p) => p.id !== item.id));
        } catch (e) {
          // Error: marcar para reintento
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
    enqueuePackageReception,
    retrySync,
  };
}