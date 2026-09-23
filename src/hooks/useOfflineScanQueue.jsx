import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';

const STORAGE_KEY = 'warehouseScanQueue';
const BACKOFF = [2000, 5000, 15000, 60000, 300000]; // 2s, 5s, 15s, 1m, 5m
const MAX_ATTEMPTS = 5;

const genId = (p) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function loadQueue() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Reset 'syncing' → 'pending' on reload (interrupted by page close)
    return Array.isArray(parsed)
      ? parsed.map((i) => (i.status === 'syncing' ? { ...i, status: 'pending' } : i))
      : [];
  } catch {
    return [];
  }
}

function isNetworkError(err) {
  const status = err?.status || err?.response?.status;
  if (status === 408 || status === 429 || status >= 500) return true;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  return /network|fetch|timeout|connection|failed/i.test(err?.message || '');
}

function isNotFound(err) {
  const status = err?.status || err?.response?.status;
  if (status === 404) return true;
  return /no encontrado/i.test(err?.message || '');
}

// Hook que gestiona una cola persistente de escaneos offline.
// Los escaneos se encolan y se procesan en segundo plano con reintentos.
export function useOfflineScanQueue({ onConfirmed, onNotFound, onClosed }) {
  const [items, setItems] = useState([]);
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const ref = useRef([]);
  const activeRef = useRef(false);
  const cbRef = useRef({ onConfirmed, onNotFound, onClosed });

  useEffect(() => {
    cbRef.current = { onConfirmed, onNotFound, onClosed };
  }, [onConfirmed, onNotFound, onClosed]);

  // Actualiza ref + state + localStorage juntos
  const setQueue = useCallback((updater) => {
    const next =
      typeof updater === 'function' ? updater(ref.current) : updater;
    ref.current = next;
    setItems(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  }, []);

  // Cargar cola al montar
  useEffect(() => {
    setQueue(loadQueue());
  }, [setQueue]);

  // Detectar online/offline
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const pendingCount = items.filter((i) => i.status !== 'done').length;

  const updateItem = useCallback(
    (id, updates) => {
      setQueue((prev) =>
        prev.map((i) => (i.id === id ? { ...i, ...updates } : i))
      );
    },
    [setQueue]
  );

  // Encolar un escaneo: devuelve el tempId local del paquete
  const enqueueScan = useCallback(
    (tracking, action, photoUrls = []) => {
      const tempId = genId('pkg');
      setQueue((prev) => [
        ...prev,
        {
          id: genId('scan'),
          type: 'scan',
          tracking,
          action,
          temp_package_id: tempId,
          photo_urls: photoUrls,
          status: 'pending',
          attempts: 0,
          next_attempt_at: Date.now(),
          scan_result: null,
          bulto_done: false,
          bulto_id: null,
          error_message: '',
          created_at: Date.now(),
        },
      ]);
      return tempId;
    },
    [setQueue]
  );

  // Encolar el cierre de un bulto
  const enqueueClose = useCallback(
    (bultoId, snapshot) => {
      setQueue((prev) => [
        ...prev,
        {
          id: genId('close'),
          type: 'close',
          bulto_id: bultoId || null,
          bulto_snapshot: snapshot,
          status: 'pending',
          attempts: 0,
          next_attempt_at: Date.now(),
          error_message: '',
          created_at: Date.now(),
        },
      ]);
    },
    [setQueue]
  );

  // Remover un item con error (tras asignación manual)
  const resolveError = useCallback(
    (tempId) => {
      setQueue((prev) => prev.filter((i) => i.temp_package_id !== tempId));
    },
    [setQueue]
  );

  // Procesar un item de escaneo: scanDispatchPackage → addPackageToBulto → createDispatchOrder
  const processScan = useCallback(
    async (item) => {
      // Step 1: scanDispatchPackage (si no se ha hecho)
      if (!item.scan_result) {
        try {
          const payload = { tracking_number: item.tracking, action: item.action };
          if (item.photo_urls?.length) {
            payload.package_image_url = item.photo_urls[0];
            payload.package_image_urls = item.photo_urls;
          }
          const res = await base44.functions.invoke('scanDispatchPackage', payload);
          const data = res?.data || res;
          if (!data?.package?.id) throw { message: 'Respuesta inválida', status: 500 };
          updateItem(item.id, { scan_result: data });
          item = { ...item, scan_result: data };
        } catch (err) {
          if (isNotFound(err)) {
            updateItem(item.id, { status: 'error', error_message: 'No encontrado' });
            cbRef.current.onNotFound?.(item.temp_package_id, item.tracking);
            return;
          }
          if (isNetworkError(err)) {
            const att = item.attempts + 1;
            if (att >= MAX_ATTEMPTS) {
              updateItem(item.id, { status: 'error', error_message: 'Sin conexión' });
              return;
            }
            updateItem(item.id, {
              status: 'pending',
              attempts: att,
              next_attempt_at: Date.now() + BACKOFF[Math.min(att - 1, BACKOFF.length - 1)],
            });
            return;
          }
          // Error real (4xx excepto 404/408/429)
          updateItem(item.id, { status: 'error', error_message: err?.message || 'Error' });
          cbRef.current.onNotFound?.(item.temp_package_id, item.tracking);
          return;
        }
      }

      // Step 2: agregar al bulto (si no se ha hecho)
      if (!item.bulto_done) {
        try {
          const pkg = item.scan_result.package;
          const client = item.scan_result.client;
          if (!pkg.client_email) {
            updateItem(item.id, { status: 'done', bulto_done: true });
            cbRef.current.onConfirmed?.(item.temp_package_id, pkg, client, null);
            return;
          }
          // Buscar bulto activo existente para este cliente
          const existing = await base44.entities.Bulto.filter(
            { client_email: pkg.client_email, status: 'activo' },
            '-created_date',
            1
          );
          let bultoData;
          if (existing?.[0]) {
            const newIds = [...(existing[0].package_ids || []), pkg.id];
            const res = await base44.functions.invoke('updateBulto', {
              bulto_id: existing[0].id,
              package_ids: newIds,
            });
            bultoData = res?.data?.bulto || existing[0];
          } else {
            const res = await base44.functions.invoke('createBulto', { package_ids: [pkg.id] });
            bultoData = res?.data?.bulto || res?.data;
          }
          // Fire-and-forget: crear/actualizar orden de despacho
          try {
            base44.functions.invoke('createDispatchOrder', {
              client_email: pkg.client_email,
              client_name: client?.full_name || pkg.client_email,
              shipping_mark: pkg.shipping_mark || client?.shipping_mark || '',
              client_snapshot: {
                full_name: client?.full_name || '',
                email: client?.email || pkg.client_email,
                cedula: client?.cedula || '',
                whatsapp: client?.whatsapp || '',
                address: client?.address || '',
                city: client?.city || '',
                state: client?.state || '',
                shipping_mark: client?.shipping_mark || '',
              },
              items: [
                {
                  tracking_number: pkg.tracking_number,
                  description: pkg.description || '',
                  consolidation_tracking: pkg.consolidation_tracking || '',
                },
              ],
            }).catch(() => {});
          } catch (_) {}
          updateItem(item.id, { status: 'done', bulto_done: true, bulto_id: bultoData?.id });
          cbRef.current.onConfirmed?.(item.temp_package_id, pkg, client, bultoData);
        } catch (err) {
          if (isNetworkError(err)) {
            const att = item.attempts + 1;
            if (att >= MAX_ATTEMPTS) {
              updateItem(item.id, { status: 'error', error_message: 'Sin conexión al agregar al bulto' });
              return;
            }
            updateItem(item.id, {
              status: 'pending',
              attempts: att,
              next_attempt_at: Date.now() + BACKOFF[Math.min(att - 1, BACKOFF.length - 1)],
            });
            return;
          }
          updateItem(item.id, { status: 'error', error_message: err?.message || 'Error al agregar al bulto' });
        }
      }
    },
    [updateItem]
  );

  // Procesar cierre de bulto
  const processClose = useCallback(
    async (item) => {
      if (!item.bulto_id) {
        updateItem(item.id, { status: 'done' });
        cbRef.current.onClosed?.(item.id);
        return;
      }
      try {
        await base44.functions.invoke('updateBulto', {
          bulto_id: item.bulto_id,
          status: 'despachado',
        });
        updateItem(item.id, { status: 'done' });
        cbRef.current.onClosed?.(item.id);
      } catch (err) {
        if (isNetworkError(err)) {
          const att = item.attempts + 1;
          if (att >= MAX_ATTEMPTS) {
            updateItem(item.id, { status: 'error', error_message: 'Sin conexión al cerrar' });
            cbRef.current.onClosed?.(item.id);
            return;
          }
          updateItem(item.id, {
            status: 'pending',
            attempts: att,
            next_attempt_at: Date.now() + BACKOFF[Math.min(att - 1, BACKOFF.length - 1)],
          });
          return;
        }
        updateItem(item.id, { status: 'error', error_message: err?.message || 'Error al cerrar' });
        cbRef.current.onClosed?.(item.id);
      }
    },
    [updateItem]
  );

  // Worker: procesa items secuencialmente
  const startWorker = useCallback(async () => {
    if (activeRef.current) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    activeRef.current = true;
    try {
      while (true) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) break;
        const now = Date.now();
        const next = ref.current.find(
          (i) => i.status === 'pending' && i.next_attempt_at <= now
        );
        if (!next) break;
        updateItem(next.id, { status: 'syncing' });
        try {
          if (next.type === 'scan') await processScan(next);
          else await processClose(next);
        } catch {
          updateItem(next.id, { status: 'pending', next_attempt_at: Date.now() + 5000 });
        }
        await new Promise((r) => setTimeout(r, 50));
      }
    } finally {
      activeRef.current = false;
    }
    // Re-agendar si hay items pendientes con timestamp futuro
    const pending = ref.current.filter((i) => i.status === 'pending');
    if (pending.length) {
      const nextTime = Math.min(...pending.map((i) => i.next_attempt_at));
      const delay = Math.max(1000, Math.min(60000, nextTime - Date.now()));
      setTimeout(() => startWorker(), delay);
    }
  }, [processScan, processClose, updateItem]);

  // Iniciar worker al montar y cuando vuelve la conexión
  useEffect(() => {
    if (typeof navigator === 'undefined' || navigator.onLine) startWorker();
    const interval = setInterval(() => {
      if (typeof navigator === 'undefined' || navigator.onLine) startWorker();
    }, 15000);
    return () => clearInterval(interval);
  }, [startWorker]);

  useEffect(() => {
    if (online) startWorker();
  }, [online, startWorker]);

  return {
    items,
    pendingCount,
    isOnline: online,
    enqueueScan,
    enqueueClose,
    resolveError,
    updateItem,
  };
}