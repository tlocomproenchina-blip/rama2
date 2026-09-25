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
  const [progress, setProgress] = useState({ clients: 0, packages: 0, bultos: 0, orders: 0, phase: '' });
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

  // Descargar todos los clientes (User con role=user) a IndexedDB.
  // Usa la función backend getWarehouseClients (asServiceRole) para saltar
  // el RLS integrado de User — los empleados de almacén con custom_role
  // no pueden llamar User.list() directamente.
  const downloadClients = useCallback(async () => {
    setProgress((p) => ({ ...p, phase: 'Descargando clientes…' }));
    let allClients = [];
    let skip = 0;
    const limit = 500;
    while (true) {
      const res = await base44.functions.invoke('getWarehouseClients', { skip, limit });
      const batch = res?.data?.clients || [];
      if (!batch.length) break;
      allClients = allClients.concat(batch);
      setProgress((p) => ({ ...p, clients: allClients.length }));
      if (!res.data.hasMore) break;
      skip += limit;
    }
    // Guardar en IndexedDB (usando email como id fallback si no tiene id)
    const withIds = allClients.map((c) => ({ ...c, id: c.id || c.email }));
    await clearStore('clients');
    await bulkPut('clients', withIds);
    return allClients.length;
  }, []);

  // Descargar paquetes en pre_alerta, recibido, disponible, sin_cliente a IndexedDB
  // Preserva paquetes locales no sincronizados (creados en WarehouseScanPack offline)
  const downloadPackages = useCallback(async () => {
    setProgress((p) => ({ ...p, phase: 'Descargando paquetes…' }));
    let allPackages = [];
    const statuses = ['pre_alerta', 'recibido', 'disponible', 'sin_cliente'];
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
    // Preservar paquetes locales no sincronizados antes de limpiar el store
    const localPackages = await getAll('packages');
    const localOnly = localPackages.filter((p) => p.is_local || String(p.id || '').startsWith('local_'));
    await clearStore('packages');
    await bulkPut('packages', [...allPackages, ...localOnly]);
    return allPackages.length;
  }, []);

  // Descargar bultos activos a IndexedDB
  // Preserva bultos locales no sincronizados (creados en WarehouseScanPack offline)
  // Filtra los bultos del servidor cuyo label_code ya fue cerrado localmente (closed_at)
  // para evitar que reaparezcan como abiertos al reconectar.
  // Deduplica por label_code para limpiar entradas repetidas.
  const downloadBultos = useCallback(async () => {
    setProgress((p) => ({ ...p, phase: 'Consolidando bultos abiertos…' }));
    // Consolidar bultos duplicados por cliente en el servidor antes de descargar
    try {
      await base44.functions.invoke('consolidateOpenBultos', {});
    } catch (_) {}
    setProgress((p) => ({ ...p, phase: 'Descargando bultos…' }));
    // Descargar bultos activos (abiertos) Y cerrados (sellados, esperando despacho).
    // Los cerrados se muestran en historial pero no en chips de bultos abiertos.
    // El estado 'cerrado' es autoritativo en el servidor — ya no dependemos de closed_at local.
    const [activos, cerrados] = await Promise.all([
      base44.entities.Bulto.filter({ status: 'activo' }, 'bulto_number', 500),
      base44.entities.Bulto.filter({ status: 'cerrado' }, 'bulto_number', 500),
    ]);
    const bultos = [...(activos || []), ...(cerrados || [])];

    // Bultos locales actuales (para preservar los no sincronizados)
    const localBultos = await getAll('bultos');

    // Deduplicar por label_code (el servidor ya distingue activo vs cerrado)
    const seenLabelCodes = new Set();
    const filtered = (bultos || []).filter((b) => {
      if (!b.label_code) return true;
      if (seenLabelCodes.has(b.label_code)) return false;
      seenLabelCodes.add(b.label_code);
      return true;
    });

    const withIds = filtered.map((b) => ({ ...b, id: b.id || `bulto_${b.label_code}` }));

    // Set de label_codes del servidor (autoritativos)
    const serverLabelCodes = new Set(withIds.map((b) => b.label_code).filter(Boolean));

    // Preservar bultos locales no sincronizados (sin closed_at) antes de limpiar el store.
    // Los bultos locales con closed_at que ya existen en el servidor se descartan (el servidor
    // ya tiene el registro autoritativo con status 'cerrado').
    const seenLocal = new Set();
    const localOnly = localBultos.filter((b) => {
      const keep = (b.is_local || String(b.id || '').startsWith('local_')) &&
        !(b.label_code && serverLabelCodes.has(b.label_code));
      if (!keep) return false;
      if (b.label_code && seenLocal.has(b.label_code)) return false;
      if (b.label_code) seenLocal.add(b.label_code);
      return true;
    });
    await clearStore('bultos');
    await bulkPut('bultos', [...withIds, ...localOnly]);
    setProgress((p) => ({ ...p, bultos: withIds.length + localOnly.length }));
    return withIds.length + localOnly.length;
  }, []);

  // Descargar órdenes de despacho recientes a IndexedDB
  const downloadDispatchOrders = useCallback(async () => {
    setProgress((p) => ({ ...p, phase: 'Descargando órdenes de despacho…' }));
    const orders = await base44.entities.DispatchOrder.list('-created_date', 200);
    const withIds = (orders || []).map((o) => ({ ...o, id: o.id }));
    await clearStore('dispatch_orders');
    await bulkPut('dispatch_orders', withIds);
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
      let ordersCount = 0;
      try { ordersCount = await downloadDispatchOrders(); } catch (_) {}
      const ts = Date.now();
      setLastSync(ts);
      try { localStorage.setItem(SYNC_FLAG_KEY, String(ts)); } catch (_) {}
      setCacheReady(true);
      setProgress({ clients: clientsCount, packages: packagesCount, bultos: bultosCount, orders: ordersCount, phase: 'Listo' });
    } catch (e) {
      setError(e?.message || 'Error al sincronizar datos');
    } finally {
      setDownloading(false);
      syncingRef.current = false;
    }
  }, [downloadClients, downloadPackages, downloadBultos, downloadDispatchOrders]);

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

  // Refrescar caché solo si es stale (>30s desde última sync). No bloquea la UI.
  // Útil para llamar antes de operaciones críticas (recibir, despachar, asignar ubicación).
  const refreshIfStale = useCallback(() => {
    const STALE_MS = 30 * 1000; // 30s
    if (!lastSync || (Date.now() - lastSync > STALE_MS)) {
      syncAll(); // no await — background
    }
  }, [lastSync, syncAll]);

  // Forzar refresh completo (tras detectar un conflicto)
  const forceRefresh = useCallback(() => syncAll(), [syncAll]);

  // Refrescar caché manualmente
  const refresh = useCallback(() => syncAll(), [syncAll]);

  return {
    cacheReady,
    downloading,
    progress,
    lastSync,
    error,
    refresh,
    refreshIfStale,
    forceRefresh,
    findByLabelCode,
    findByTracking,
    getClientByEmail,
    searchClients,
  };
}