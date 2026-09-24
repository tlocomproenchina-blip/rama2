import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import {
  bulkPut, getAll, findPackageByLabelCode, findPackageByTracking,
  findClientByEmail, searchClientsLocal, clearStore, count,
} from '@/lib/offlineDb';

// Hook principal del flujo offline-first de WarehouseScanPack.
// Gestiona:
// 1. Descarga inicial de clientes + paquetes a IndexedDB (al montar).
// 2. Refresco en segundo plano.
// 3. Búsquedas locales instantáneas (findByLabelCode, findByTracking, searchClients).
// 4. Estado de sincronización (caché lista, descargando, progreso).

const SYNC_FLAG_KEY = 'tlec_warehouse_last_sync';
const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 min: si la caché es más vieja, refrescar

export function useOfflineWarehouseData() {
  const [cacheReady, setCacheReady] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState({ clients: 0, packages: 0, bultos: 0, phase: '' });
  const [lastSync, setLastSync] = useState(null);
  const [error, setError] = useState(null);
  const syncingRef = useRef(false);

  // Cargar timestamp de última sincronización desde localStorage
  useEffect(() => {
    try {
      const ts = localStorage.getItem(SYNC_FLAG_KEY);
      if (ts) setLastSync(Number(ts));
    } catch (_) {}
  }, []);

  // Descargar todos los clientes (User con role=user) a IndexedDB
  const downloadClients = useCallback(async () => {
    setProgress((p) => ({ ...p, phase: 'Descargando clientes…' }));
    // Traer todos los usuarios en lotes de 500
    let allClients = [];
    let skip = 0;
    const limit = 500;
    while (true) {
      const batch = await base44.entities.User.list('email', limit, skip);
      if (!batch || !batch.length) break;
      // Filtrar solo role=user (clientes)
      const clients = batch.filter((u) => u.role === 'user');
      allClients = allClients.concat(clients);
      setProgress((p) => ({ ...p, clients: allClients.length }));
      if (batch.length < limit) break;
      skip += limit;
    }
    // Guardar en IndexedDB (usando email como id fallback si no tiene id)
    const withIds = allClients.map((c) => ({ ...c, id: c.id || c.email }));
    await clearStore('clients');
    await bulkPut('clients', withIds);
    return allClients.length;
  }, []);

  // Descargar paquetes en pre_alerta, recibido, sin_cliente a IndexedDB
  const downloadPackages = useCallback(async () => {
    setProgress((p) => ({ ...p, phase: 'Descargando paquetes…' }));
    let allPackages = [];
    const statuses = ['pre_alerta', 'recibido', 'sin_cliente'];
    for (const status of statuses) {
      let skip = 0;
      const limit = 500;
      while (true) {
        const batch = await base44.entities.Package.filter({ status }, '-created_date', limit, skip);
        if (!batch || !batch.length) break;
        allPackages = allPackages.concat(batch);
        setProgress((p) => ({ ...p, packages: allPackages.length }));
        if (batch.length < limit) break;
        skip += limit;
      }
    }
    await clearStore('packages');
    await bulkPut('packages', allPackages);
    return allPackages.length;
  }, []);

  // Descargar bultos activos a IndexedDB
  const downloadBultos = useCallback(async () => {
    setProgress((p) => ({ ...p, phase: 'Descargando bultos abiertos…' }));
    const bultos = await base44.entities.Bulto.filter({ status: 'activo' }, 'bulto_number', 500);
    const withIds = (bultos || []).map((b) => ({ ...b, id: b.id || `bulto_${b.label_code}` }));
    await clearStore('bultos');
    await bulkPut('bultos', withIds);
    setProgress((p) => ({ ...p, bultos: withIds.length }));
    return withIds.length;
  }, []);

  // Descarga inicial completa
  const syncAll = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setDownloading(true);
    setError(null);
    try {
      const clientsCount = await downloadClients();
      const packagesCount = await downloadPackages();
      const bultosCount = await downloadBultos();
      const ts = Date.now();
      setLastSync(ts);
      try { localStorage.setItem(SYNC_FLAG_KEY, String(ts)); } catch (_) {}
      setCacheReady(true);
      setProgress({ clients: clientsCount, packages: packagesCount, bultos: bultosCount, phase: 'Listo' });
    } catch (e) {
      setError(e?.message || 'Error al sincronizar datos');
    } finally {
      setDownloading(false);
      syncingRef.current = false;
    }
  }, [downloadClients, downloadPackages, downloadBultos]);

  // Al montar: si hay caché y es reciente, marcar lista y refrescar en segundo plano.
  // Si no hay caché o es vieja, descargar bloqueando.
  useEffect(() => {
    (async () => {
      const pkgCount = await count('packages');
      const clientCount = await count('clients');
      const hasCache = pkgCount > 0 || clientCount > 0;
      const isStale = lastSync ? (Date.now() - lastSync > STALE_THRESHOLD_MS) : true;

      if (hasCache && !isStale) {
        // Caché fresca: marcar lista y refrescar en segundo plano
        setCacheReady(true);
        syncAll(); // no await — background
      } else if (hasCache && isStale) {
        // Caché vieja: marcar lista pero refrescar en segundo plano
        setCacheReady(true);
        syncAll();
      } else {
        // Sin caché: descargar bloqueando
        await syncAll();
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Búsquedas locales (instantáneas, 0ms servidor) ---

  const findByLabelCode = useCallback((code) => findPackageByLabelCode(code), []);
  const findByTracking = useCallback((tracking) => findPackageByTracking(tracking), []);
  const getClientByEmail = useCallback((email) => findClientByEmail(email), []);
  const searchClients = useCallback((query) => searchClientsLocal(query), []);

  // Refrescar caché manualmente
  const refresh = useCallback(() => syncAll(), [syncAll]);

  return {
    cacheReady,
    downloading,
    progress,
    lastSync,
    error,
    refresh,
    findByLabelCode,
    findByTracking,
    getClientByEmail,
    searchClients,
  };
}