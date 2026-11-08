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

// onRelabeled(bulto): el código ya lo tenía otra unidad y el servidor le asignó uno
// nuevo a este bulto; se usa para imprimir sus etiquetas con el código nuevo.
// onDuplicate(list): trackings que el servidor no registró porque ya estaban en otra unidad.
export function useOfflineBultoSync({ onRelabeled, onDuplicate } = {}) {
  const onRelabeledRef = useRef(onRelabeled);
  onRelabeledRef.current = onRelabeled;
  const onDuplicateRef = useRef(onDuplicate);
  onDuplicateRef.current = onDuplicate;

  // Unidad cuyo contenido completo ya estaba registrado: no se registra ni se imprime.
  const dropLocalUnit = async (item) => {
    const localBultos = await getAll('bultos').catch(() => []);
    for (const b of localBultos) {
      if ((b.local_bulto_id || b.id) === item.id) await del('bultos', b.id).catch(() => null);
    }
  };
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

  // Encolar una caja consolidada cerrada: el servidor la registra y absorbe los bultos
  // pequeños que van dentro (esos bultos se eliminan allí, no en el dispositivo).
  const enqueueCaja = useCallback(async (cajaData) => {
    const queueItem = {
      id: cajaData.local_bulto_id || `caja_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ...cajaData,
      type: 'caja',
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
          if (item.type === 'caja') {
            // La caja consolidada se registra con su contenido: el servidor absorbe los
            // bultos pequeños escaneados dentro de ella y los elimina.
            const res = await base44.functions.invoke('syncCaja', {
              local_unit_id: item.id,
              label_code: item.label_code,
              client_email: item.client_email,
              package_codes: item.package_codes || [],
              absorb_codes: item.absorb_codes || [],
              combine_codes: item.combine_codes || [],
              unregistered_codes: item.unregistered_codes || [],
              cbm_order_numbers: item.cbm_order_numbers || [],
              device_id: item.device_id || '',
              recognition_photo_url: item.recognition_photo_url || '',
            });
            const data = res?.data || res || {};
            if (data?.duplicates?.length) onDuplicateRef.current?.(data.duplicates);
            if (data?.duplicate_only) {
              await dropLocalUnit(item);
              await del('sync_queue', item.id);
              setPendingBultos((prev) => prev.filter((p) => p.id !== item.id));
              continue;
            }
            if (!data?.caja) throw new Error(data?.error || 'No se pudo registrar la caja');

            // La caja local queda enlazada con el servidor y los bultos absorbidos se
            // sueltan del dispositivo: su contenido ya vive dentro de la caja.
            try {
              const localBultos = await getAll('bultos');
              const localCaja = localBultos.find(
                (b) => (b.local_bulto_id || b.id) === item.id || b.label_code === item.label_code
              );
              if (localCaja) {
                await put('bultos', {
                  ...localCaja,
                  ...data.caja,
                  id: localCaja.id,
                  is_local: false,
                  synced: true,
                  server_bulto_id: data.caja.id,
                });
              }
              for (const code of [...(item.absorb_codes || []), ...(item.combine_codes || [])]) {
                const absorbed = localBultos.find(
                  (b) => b.label_code === code && (b.local_bulto_id || b.id) !== item.id
                );
                if (absorbed?.id) await del('bultos', absorbed.id);
              }
            } catch (_) {}

            if (data.relabeled) {
              toast.warning(
                `El código ${data.relabeled.from} ya lo tenía otra unidad: esta caja quedó como ${data.relabeled.to}.`,
                { duration: 12000 }
              );
            }

            const warnings = data?.absorbed?.warnings || [];
            if (warnings.length) {
              toast.info(`Caja ${item.label_code}: ${warnings[0]}`, { duration: 6000 });
            }
          } else if (item.type === 'package_reception') {
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
              combine_codes: item.combine_codes || [],
              warehouse_id: item.warehouse_id || '',
              created_by: item.created_by || '',
              closed_at: item.closed_at || new Date().toISOString(),
            });
            if (res?.data?.duplicates?.length) onDuplicateRef.current?.(res.data.duplicates);
            if (res?.data?.duplicate) {
              await dropLocalUnit(item);
              await del('sync_queue', item.id);
              setPendingBultos((prev) => prev.filter((p) => p.id !== item.id));
              continue;
            }
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
                const relabeled = res?.data?.relabeled;
                if (localBulto) {
                  // 'already_exists' significa que ese código ya estaba usado en el
                  // sistema: la etiqueta nueva no se registró y la pantalla lo avisa.
                  const updated = {
                    ...localBulto,
                    // Código definitivo: el que quedó guardado en el servidor.
                    label_code: res.data.bulto.label_code || localBulto.label_code,
                    bulto_number: res.data.bulto.bulto_number || localBulto.bulto_number,
                    server_bulto_id: serverBultoId,
                    synced: true,
                  };
                  await put('bultos', updated);
                  // Se imprime solo con el código definitivo ya guardado (y si aún no se imprimió).
                  if (!(res?.data?.bulto?.print_count > 0)) onRelabeledRef.current?.(updated);
                }
                if (relabeled) {
                  toast.warning(
                    `El código ${relabeled.from} ya lo tenía otra unidad: este bulto quedó como ${relabeled.to}.`,
                    { duration: 12000 }
                  );
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
    enqueueCaja,
    enqueuePackageReception,
    retrySync,
  };
}