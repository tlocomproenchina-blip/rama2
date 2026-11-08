import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { getAll, put, del } from '@/lib/offlineDb';
import { toast } from 'sonner';
import { syncCajaLabels, syncPrintLog, syncScanPhoto } from '@/lib/packSyncTasks';

// Cola offline de la Mesa de empaque (IndexedDB 'sync_queue'). Todo lo que hace el
// operador se guarda primero en el dispositivo con su hora real y la mesa sigue
// trabajando: bultos y cajas cerrados, recepciones, fotos de escaneo, impresiones y
// numeración de etiquetas. Al haber conexión se entrega en segundo plano, en el orden en
// que ocurrió. El servidor valida: los trackings que ya estaban registrados se omiten y
// se guarda el resto. Lo que falle por red se reintenta solo, sin detener la mesa.

const RETRY_MS = 45000;
const byCreated = (a, b) => (a.created_at || 0) - (b.created_at || 0);
// La foto (base64) vive solo en IndexedDB: la pantalla no la necesita en memoria.
const lite = ({ image_base64, ...rest }) => rest;
const newId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// onRelabeled(bulto): el servidor le dio otro código al bulto (el suyo ya lo tenía otra
// unidad); se reimprime con el código nuevo.
// onDuplicate(list): trackings que el servidor omitió porque ya estaban en otra unidad.
export function useOfflineBultoSync({ onRelabeled, onDuplicate } = {}) {
  const onRelabeledRef = useRef(onRelabeled);
  onRelabeledRef.current = onRelabeled;
  const onDuplicateRef = useRef(onDuplicate);
  onDuplicateRef.current = onDuplicate;

  const [pendingBultos, setPendingBultos] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const processingRef = useRef(false);
  const processRef = useRef(() => {});

  const removeFromState = (id) => setPendingBultos((prev) => prev.filter((p) => p.id !== id));
  const patchState = (id, patch) =>
    setPendingBultos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  // Unidad cuyo contenido completo ya estaba registrado: no se registra. También se
  // sueltan sus impresiones pendientes (no hay bulto al que asignarlas).
  const dropLocalUnit = async (item) => {
    const localBultos = await getAll('bultos').catch(() => []);
    for (const b of localBultos) {
      if ((b.local_bulto_id || b.id) === item.id) await del('bultos', b.id).catch(() => null);
    }
    const queue = await getAll('sync_queue').catch(() => []);
    for (const q of queue) {
      if (q.type === 'print_log' && q.bulto_local_id === item.id) {
        await del('sync_queue', q.id).catch(() => null);
        removeFromState(q.id);
      }
    }
    toast.info(`${item.label_code || 'La unidad'} ya estaba registrada: no se volvió a registrar.`, { duration: 5000 });
  };

  useEffect(() => {
    (async () => {
      const queue = await getAll('sync_queue').catch(() => []);
      setPendingBultos(queue.sort(byCreated).map(lite));
      processRef.current();
    })();
  }, []);

  // Conexión, regreso a la pantalla y reintento periódico mientras haya pendientes.
  useEffect(() => {
    const run = () => processRef.current();
    const handleOnline = () => { setIsOnline(true); run(); };
    const handleOffline = () => setIsOnline(false);
    const handleVisible = () => { if (!document.hidden && navigator.onLine) run(); };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisible);
    const timer = setInterval(() => { if (navigator.onLine) run(); }, RETRY_MS);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisible);
      clearInterval(timer);
    };
  }, []);

  const enqueueItem = useCallback(async (item) => {
    const queueItem = { sync_status: 'pending', created_at: Date.now(), ...item };
    await put('sync_queue', queueItem);
    setPendingBultos((prev) => [...prev.filter((p) => p.id !== queueItem.id), lite(queueItem)]);
    processRef.current();
    return queueItem;
  }, []);

  const enqueueClosedBulto = useCallback((bultoData) => enqueueItem({
    id: bultoData.local_bulto_id || newId('sync'),
    ...bultoData,
    type: 'bulto',
  }), [enqueueItem]);

  // Caja consolidada cerrada: el servidor la registra y absorbe los bultos que van dentro.
  const enqueueCaja = useCallback((cajaData) => enqueueItem({
    id: cajaData.local_bulto_id || newId('caja'),
    ...cajaData,
    type: 'caja',
  }), [enqueueItem]);

  const enqueuePackageReception = useCallback((pkg) => {
    if (!pkg?.id) return null;
    return enqueueItem({
      id: `pkg_${pkg.id}`,
      type: 'package_reception',
      package_id: pkg.id,
      tracking_number: pkg.tracking_number || '',
      status: 'recibido',
      received_date: pkg.received_date || new Date().toISOString(),
      received_by: pkg.received_by || '',
    });
  }, [enqueueItem]);

  // Foto del escaneo: queda en el dispositivo hasta que se pueda subir.
  const enqueueScanPhoto = useCallback(({ pkg, base64 }) => {
    if (!pkg?.id || !base64) return null;
    return enqueueItem({
      id: newId('photo'),
      type: 'scan_photo',
      package_id: pkg.id,
      tracking_number: pkg.tracking_number || '',
      image_base64: base64,
      captured_at: new Date().toISOString(),
    });
  }, [enqueueItem]);

  // Etiquetas impresas en el dispositivo: la impresión se registra al reconectar.
  const enqueuePrintLogs = useCallback(async (items = []) => {
    const printedAt = new Date().toISOString();
    for (const it of items) {
      await enqueueItem({
        id: newId('print'),
        type: 'print_log',
        bulto_local_id: it.id,
        label_code: it.bulto_snapshot?.label_code || it.label_code || '',
        printed_at: printedAt,
      });
    }
  }, [enqueueItem]);

  // Numeración X/N de la tira de cajas que ya se imprimió.
  const enqueueCajaLabels = useCallback(({ clientEmail, cajas = [] }) => {
    if (!clientEmail || !cajas.length) return null;
    const printedAt = new Date().toISOString();
    return enqueueItem({
      id: newId('cajalabels'),
      type: 'caja_labels',
      client_email: clientEmail,
      assignments: cajas.map((c) => ({
        label_code: c.label_code,
        caja_number: c.caja_number,
        caja_total: c.caja_total,
        printed_at: printedAt,
      })),
    });
  }, [enqueueItem]);

  const syncCaja = async (item) => {
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
      closed_at: item.closed_at || '',
    });
    const data = res?.data || res || {};
    if (data?.duplicates?.length) onDuplicateRef.current?.(data.duplicates);
    if (data?.duplicate_only) { await dropLocalUnit(item); return; }
    if (!data?.caja) throw new Error(data?.error || 'No se pudo registrar la caja');

    // La caja local queda enlazada con el servidor y los bultos absorbidos se sueltan
    // del dispositivo: su contenido ya vive dentro de la caja.
    const localBultos = await getAll('bultos').catch(() => []);
    const localCaja = localBultos.find(
      (b) => (b.local_bulto_id || b.id) === item.id || b.label_code === item.label_code
    );
    if (localCaja) {
      await put('bultos', {
        ...localCaja, ...data.caja, id: localCaja.id, is_local: false, synced: true, server_bulto_id: data.caja.id,
      }).catch(() => {});
    }
    for (const code of [...(item.absorb_codes || []), ...(item.combine_codes || [])]) {
      const absorbed = localBultos.find((b) => b.label_code === code && (b.local_bulto_id || b.id) !== item.id);
      if (absorbed?.id) await del('bultos', absorbed.id).catch(() => null);
    }
    if (data.relabeled) {
      toast.warning(`El código ${data.relabeled.from} ya lo tenía otra unidad: esta caja quedó como ${data.relabeled.to}.`, { duration: 12000 });
    }
  };

  const syncBulto = async (item) => {
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
      closed_at: item.closed_at || new Date(item.created_at || Date.now()).toISOString(),
    });
    const data = res?.data || {};
    if (data.duplicates?.length) onDuplicateRef.current?.(data.duplicates);
    if (data.duplicate) { await dropLocalUnit(item); return; }
    if (!data.success && !data.already_exists) throw new Error(data.error || 'Error desconocido');

    const serverBulto = data.bulto;
    if (!serverBulto?.id) return;
    const localBultos = await getAll('bultos').catch(() => []);
    const localBulto = localBultos.find((b) => (b.local_bulto_id || b.id) === item.id);
    if (!localBulto) return;
    const updated = {
      ...localBulto,
      label_code: serverBulto.label_code || localBulto.label_code,
      bulto_number: serverBulto.bulto_number || localBulto.bulto_number,
      server_bulto_id: serverBulto.id,
      synced: true,
    };
    await put('bultos', updated).catch(() => {});
    // La etiqueta ya se imprimió al cerrar: solo se reimprime si el código cambió.
    if (data.relabeled) {
      onRelabeledRef.current?.(updated);
      toast.warning(`El código ${data.relabeled.from} ya lo tenía otra unidad: este bulto quedó como ${data.relabeled.to}. Se reimprime su etiqueta.`, { duration: 12000 });
    }
  };

  const syncReception = async (item) => {
    await base44.entities.Package.update(item.package_id, {
      status: item.status,
      received_date: item.received_date,
      received_by: item.received_by,
    });
  };

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    processingRef.current = true;
    setIsSyncing(true);
    try {
      const queue = (await getAll('sync_queue').catch(() => [])).sort(byCreated);
      for (const item of queue) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) break;
        patchState(item.id, { sync_status: 'syncing' });
        try {
          if (item.type === 'caja') await syncCaja(item);
          else if (item.type === 'package_reception') await syncReception(item);
          else if (item.type === 'scan_photo') await syncScanPhoto(item, (next) => put('sync_queue', next));
          else if (item.type === 'print_log') await syncPrintLog(item);
          else if (item.type === 'caja_labels') await syncCajaLabels(item);
          else await syncBulto(item);
          await del('sync_queue', item.id);
          removeFromState(item.id);
        } catch (e) {
          const message = e?.response?.data?.error || e?.message || 'Error de red';
          const latest = (await getAll('sync_queue').catch(() => [])).find((q) => q.id === item.id) || item;
          // Impresión de una unidad que nunca llegó al servidor (se absorbió en una caja o
          // se descartó): tras muchos intentos se suelta para no reintentarla para siempre.
          if (item.type === 'print_log' && (latest.attempts || 0) >= 20) {
            await del('sync_queue', item.id).catch(() => null);
            removeFromState(item.id);
            continue;
          }
          await put('sync_queue', { ...latest, sync_status: 'error', error_message: message, attempts: (latest.attempts || 0) + 1 }).catch(() => {});
          patchState(item.id, { sync_status: 'error', error_message: message });
          // Sin red o con exceso de solicitudes: se espera al próximo intento.
          if (/429|network|fetch|Failed/i.test(message)) break;
        }
      }
    } finally {
      processingRef.current = false;
      setIsSyncing(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  processRef.current = processQueue;

  const retrySync = useCallback(() => processQueue(), [processQueue]);

  return {
    pendingBultos,
    isSyncing,
    isOnline,
    enqueueClosedBulto,
    enqueueCaja,
    enqueuePackageReception,
    enqueueScanPhoto,
    enqueuePrintLogs,
    enqueueCajaLabels,
    retrySync,
  };
}