// Hook principal del módulo de almacén offline-first.
// Gestiona cache local (IndexedDB), escaneo local, bultos locales y sincronización.
import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import * as db from '@/lib/offlineDb';
import { runSync } from '@/lib/offlineSync';

const genId = (p) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export function useOfflineWarehouse() {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [cacheReady, setCacheReady] = useState(false);
  const [caching, setCaching] = useState(false);
  const [openBultos, setOpenBultos] = useState([]);
  const [pendingSync, setPendingSync] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const openBultosRef = useRef([]);
  const syncRunningRef = useRef(false);

  // Solicitar almacenamiento persistente al montar
  useEffect(() => {
    db.requestPersistentStorage();
  }, []);

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

  const updateBultosState = useCallback((updater) => {
    const next = typeof updater === 'function' ? updater(openBultosRef.current) : updater;
    openBultosRef.current = next;
    setOpenBultos(next);
  }, []);

  const refreshPendingCount = useCallback(async () => {
    try {
      const outbox = await db.getAll('sync_outbox');
      setPendingSync(outbox.filter((i) => i.status === 'pending' || i.status === 'syncing').length);
    } catch (_) {}
  }, []);

  // Cargar bultos abiertos desde IndexedDB
  const loadLocalBultos = useCallback(async () => {
    try {
      const bultos = await db.getAll('bultos');
      const active = bultos.filter((b) => b.status === 'activo');
      updateBultosState(active);
    } catch (_) {}
  }, [updateBultosState]);

  // Cache de datos del sistema → IndexedDB
  const cacheData = useCallback(async () => {
    setCaching(true);
    try {
      // Clientes (usuarios con role='user')
      const clients = await base44.entities.User.filter({ role: 'user' }, '-created_date', 5000);
      await db.bulkPut('clients', (clients || []).map((c) => ({
        email: c.email,
        full_name: c.full_name || '',
        shipping_mark: c.shipping_mark || '',
        cedula: c.cedula || '',
        whatsapp: c.whatsapp || '',
        address: c.address || '',
        city: c.city || '',
        state: c.state || '',
      })));

      // Paquetes recientes (pre_alerta y recibido son los escaneables)
      // Se fetchan sin filtro de status para compatibilidad, y se filtran al guardar
      const packages = await base44.entities.Package.list('-created_date', 5000);
      const activePackages = (packages || []).filter(
        (p) => p.status === 'pre_alerta' || p.status === 'recibido'
      );
      await db.bulkPut('packages', activePackages);

      // Bultos abiertos
      const bultos = await base44.entities.Bulto.filter({ status: 'activo' }, '-created_date', 500);
      await db.bulkPut('bultos', bultos || []);

      // Etiquetas disponibles
      const labels = await base44.entities.ShippingLabel.filter({ status: 'disponible' }, '-created_date', 2000);
      await db.bulkPut('shipping_labels', labels || []);

      await db.setMeta('lastCache', Date.now());
      setCacheReady(true);
      await loadLocalBultos();
    } catch (e) {
      console.error('Error cacheando datos:', e);
    } finally {
      setCaching(false);
    }
  }, [loadLocalBultos]);

  // Carga inicial
  useEffect(() => {
    (async () => {
      await loadLocalBultos();
      await refreshPendingCount();
      const lastCache = await db.getMeta('lastCache');
      const stale = !lastCache || Date.now() - lastCache > 5 * 60 * 1000;
      if (navigator.onLine && stale) {
        await cacheData();
      } else {
        setCacheReady(true);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Refrescar cache al volver la conexión
  useEffect(() => {
    if (online) {
      cacheData();
      syncNow();
    }
  }, [online]); // eslint-disable-line react-hooks/exhaustive-deps

  // Búsqueda local de paquete por tracking o label_code
  const localLookup = useCallback(async (tracking) => {
    const cleaned = (tracking || '').trim().toUpperCase();
    if (!cleaned) return null;
    try {
      // 1. Match exacto por label_code
      const byLabel = await db.getByIndex('packages', 'label_code', cleaned);
      if (byLabel) return byLabel;
      // 2. Match exacto por tracking_number
      const byTracking = await db.getByIndex('packages', 'tracking_number', cleaned);
      if (byTracking) return byTracking;
      // 3. Match por sub-tracking (el escaneado es parte del tracking completo)
      const all = await db.getAll('packages');
      const sub = all.find((p) => {
        const tn = (p.tracking_number || '').toUpperCase();
        if (!tn) return false;
        return tn.includes(cleaned) || cleaned.includes(tn);
      });
      return sub || null;
    } catch (_) {
      return null;
    }
  }, []);

  // Buscar cliente local por email, nombre o shipping_mark
  const searchClientsLocal = useCallback(async (query) => {
    const q = (query || '').trim().toLowerCase();
    if (!q) return [];
    try {
      const all = await db.getAll('clients');
      return all
        .filter((c) => {
          const email = (c.email || '').toLowerCase();
          const name = (c.full_name || '').toLowerCase();
          const mark = (c.shipping_mark || '').toLowerCase();
          return email.includes(q) || name.includes(q) || mark.includes(q);
        })
        .slice(0, 20);
    } catch (_) {
      return [];
    }
  }, []);

  // Escaneo local: busca paquete, marca despachado, agrega a bulto
  const localScan = useCallback(async (tracking, photoUrls = []) => {
    const pkg = await localLookup(tracking);
    if (!pkg) return { found: false };

    const now = new Date().toISOString();
    const updatedPkg = {
      ...pkg,
      status: 'despachado',
      dispatched_date: now,
      dispatched_by: 'warehouse',
      ...(photoUrls.length ? { package_image_urls: photoUrls } : {}),
    };
    await db.put('packages', updatedPkg);

    // Agregar al bulto del cliente (local)
    let bulto = openBultosRef.current.find((b) => b.client_email === pkg.client_email);
    if (!bulto) {
      const bultoId = genId('local_bulto');
      bulto = {
        id: bultoId,
        label_code: `${pkg.shipping_mark || 'TLEC'}-B1`,
        client_email: pkg.client_email,
        shipping_mark: pkg.shipping_mark || '',
        bulto_number: 1,
        total_bultos: 1,
        package_ids: [pkg.id],
        package_trackings: [pkg.tracking_number],
        status: 'activo',
        created_by: 'warehouse',
        _local: true,
      };
    } else {
      bulto = {
        ...bulto,
        package_ids: [...(bulto.package_ids || []), pkg.id],
        package_trackings: [...(bulto.package_trackings || []), pkg.tracking_number],
      };
    }
    await db.put('bultos', bulto);
    updateBultosState((prev) => {
      const exists = prev.find((b) => b.id === bulto.id);
      return exists ? prev.map((b) => (b.id === bulto.id ? bulto : b)) : [...prev, bulto];
    });

    // Encolar sincronización
    await db.put('sync_outbox', {
      id: genId('sync'),
      type: 'dispatch_package',
      tracking: pkg.tracking_number,
      photo_urls: photoUrls,
      status: 'pending',
      attempts: 0,
      created_at: Date.now(),
    });
    refreshPendingCount();

    return { found: true, package: updatedPkg, bulto };
  }, [localLookup, updateBultosState, refreshPendingCount]);

  // Asignación manual local: crea paquete + agrega a bulto
  const localManualAssign = useCallback(async (tracking, client, photoUrls = []) => {
    const now = new Date().toISOString();
    const pkgId = genId('local_pkg');
    const pkg = {
      id: pkgId,
      tracking_number: tracking,
      client_email: client.email,
      shipping_mark: client.shipping_mark || '',
      shipping_type: 'maritimo',
      status: 'despachado',
      description: 'Paquete manual',
      received_date: now,
      dispatched_date: now,
      _local: true,
    };
    await db.put('packages', pkg);

    let bulto = openBultosRef.current.find((b) => b.client_email === client.email);
    if (!bulto) {
      const bultoId = genId('local_bulto');
      bulto = {
        id: bultoId,
        label_code: `${client.shipping_mark || 'TLEC'}-B1`,
        client_email: client.email,
        shipping_mark: client.shipping_mark || '',
        bulto_number: 1,
        total_bultos: 1,
        package_ids: [pkgId],
        package_trackings: [tracking],
        status: 'activo',
        created_by: 'warehouse',
        _local: true,
      };
    } else {
      bulto = {
        ...bulto,
        package_ids: [...(bulto.package_ids || []), pkgId],
        package_trackings: [...(bulto.package_trackings || []), tracking],
      };
    }
    await db.put('bultos', bulto);
    updateBultosState((prev) => {
      const exists = prev.find((b) => b.id === bulto.id);
      return exists ? prev.map((b) => (b.id === bulto.id ? bulto : b)) : [...prev, bulto];
    });

    await db.put('sync_outbox', {
      id: genId('sync'),
      type: 'manual_package',
      local_package_id: pkgId,
      tracking,
      client_email: client.email,
      client_snapshot: client,
      photo_urls: photoUrls,
      status: 'pending',
      attempts: 0,
      created_at: Date.now(),
    });
    refreshPendingCount();

    return { package: pkg, bulto };
  }, [updateBultosState, refreshPendingCount]);

  // Cerrar bulto localmente
  const localCloseBulto = useCallback(async (bulto) => {
    const updated = { ...bulto, status: 'despachado' };
    await db.put('bultos', updated);
    updateBultosState((prev) => prev.filter((b) => b.id !== bulto.id));

    await db.put('sync_outbox', {
      id: genId('sync'),
      type: 'close_bulto',
      bulto_id: bulto.id,
      bulto_snapshot: bulto,
      status: 'pending',
      attempts: 0,
      created_at: Date.now(),
    });
    refreshPendingCount();
    return updated;
  }, [updateBultosState, refreshPendingCount]);

  // Quitar último paquete del bulto localmente
  const localRemoveLast = useCallback(async (bulto) => {
    const ids = bulto.package_ids || [];
    if (!ids.length) return;
    const newIds = ids.slice(0, -1);
    const newTrackings = (bulto.package_trackings || []).slice(0, -1);

    if (newIds.length === 0) {
      await db.del('bultos', bulto.id);
      updateBultosState((prev) => prev.filter((b) => b.id !== bulto.id));
    } else {
      const updated = { ...bulto, package_ids: newIds, package_trackings: newTrackings };
      await db.put('bultos', updated);
      updateBultosState((prev) => prev.map((b) => (b.id === bulto.id ? updated : b)));
    }

    // Solo sincronizar si el bulto no es local
    if (!String(bulto.id).startsWith('local_')) {
      await db.put('sync_outbox', {
        id: genId('sync'),
        type: 'remove_package',
        bulto_id: bulto.id,
        new_ids: newIds,
        status: 'pending',
        attempts: 0,
        created_at: Date.now(),
      });
      refreshPendingCount();
    }
  }, [updateBultosState, refreshPendingCount]);

  // Sincronización manual
  const syncNow = useCallback(async () => {
    if (syncRunningRef.current) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    syncRunningRef.current = true;
    setSyncing(true);
    try {
      await runSync(() => refreshPendingCount());
      setLastSyncAt(Date.now());
      // Refrescar bultos locales después de sincronizar
      await loadLocalBultos();
    } finally {
      syncRunningRef.current = false;
      setSyncing(false);
      refreshPendingCount();
    }
  }, [refreshPendingCount, loadLocalBultos]);

  // Auto-sync cada 30s cuando hay conexión
  useEffect(() => {
    if (!online) return;
    const interval = setInterval(() => syncNow(), 30000);
    return () => clearInterval(interval);
  }, [online, syncNow]);

  return {
    online,
    cacheReady,
    caching,
    openBultos,
    pendingSync,
    syncing,
    lastSyncAt,
    cacheData,
    localLookup,
    localScan,
    localManualAssign,
    localCloseBulto,
    localRemoveLast,
    searchClientsLocal,
    syncNow,
  };
}