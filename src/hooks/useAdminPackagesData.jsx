import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { toast } from 'sonner';
import { getStatsCache, setStatsCache } from '@/lib/offlineDb';

/**
 * Hook que encapsula la carga paginada de paquetes para el panel admin.
 * Maneja: búsqueda con debounce, filtros, paginación, carga incremental y conteos globales.
 */
export function useAdminPackagesData({ pageSize = 50 } = {}) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reportedFilter, setReportedFilter] = useState('all');
  const [advancedFilters, setAdvancedFilters] = useState(null);
  const [totalFiltered, setTotalFiltered] = useState(0);
  const [globalCounts, setGlobalCounts] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const reqSeqRef = useRef(0);

  // Debounce del input de búsqueda
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const loadPackages = useCallback(async (append = false, skipOverride = 0) => {
    const seq = ++reqSeqRef.current;
    if (append) setLoadingMore(true); else setLoading(true);
    const skip = append ? skipOverride : 0;
    try {
      const res = await base44.functions.invoke('listPackagesForSupport', {
        limit: pageSize,
        skip,
        q: debouncedSearch,
        statusFilter,
        reportedFilter,
        advancedFilters,
      });
      // Ignorar respuestas obsoletas (llegó una búsqueda más reciente)
      if (seq !== reqSeqRef.current) return;
      const pkgs = res?.data?.data || [];
      const total = res?.data?.total || 0;
      if (append) {
        setPackages(prev => [...prev, ...pkgs]);
      } else {
        setPackages(pkgs);
        setTotalFiltered(total);
        // Guardar en IndexedDB para servir offline
        try { await setStatsCache('admin_packages_list', { packages: pkgs, total }); } catch (_) {}
      }
      setHasMore(res?.data?.hasMore || false);
    } catch (e) {
      // Si falla la red, intentar servir del cache de IndexedDB
      if (!append) {
        try {
          const cached = await getStatsCache('admin_packages_list');
          if (cached?.data?.packages?.length > 0) {
            setPackages(cached.data.packages);
            setTotalFiltered(cached.data.total || cached.data.packages.length);
            setHasMore(false);
            if (!navigator.onLine) {
              toast.info('Sin conexión — mostrando paquetes en cache');
            }
          } else if (!navigator.onLine) {
            toast.error('Sin conexión y sin cache disponible');
          }
        } catch (_) {
          toast.error('Error al cargar paquetes');
        }
      } else {
        console.error('Error loading packages:', e);
      }
    }
    if (seq !== reqSeqRef.current) return;
    if (append) setLoadingMore(false); else setLoading(false);
  }, [debouncedSearch, statusFilter, reportedFilter, advancedFilters, pageSize]);

  // Cargar conteos globales (registro único PackageCounts, sin escaneo)
  const loadCounts = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('getPackageCounts', {});
      const counts = res?.data?.counts;
      if (counts) setGlobalCounts(counts);
    } catch (e) {
      console.error('Error loading package counts:', e);
    }
  }, []);

  // Recargar cuando cambien filtros o búsqueda
  useEffect(() => {
    loadPackages(false);
  }, [loadPackages]);

  // Cargar conteos globales una sola vez al montar
  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  // Suscripción realtime: reflejar borrados y actualizaciones de Package
  // que ocurran desde cualquier otra página (AdminOrphanPackages, etc.).
  useEffect(() => {
    const unsubscribe = base44.entities.Package.subscribe((event) => {
      if (!event || !event.data) return;
      const pkg = event.data;
      if (event.type === 'delete') {
        const removedId = pkg.id || event.id;
        if (!removedId) return;
        setPackages((prev) => prev.filter((p) => p.id !== removedId));
        setTotalFiltered((prev) => Math.max(0, prev - 1));
      } else if (event.type === 'update') {
        if (!pkg.id) return;
        setPackages((prev) => prev.map((p) => (p.id === pkg.id ? { ...p, ...pkg } : p)));
      }
    });
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, []);

  const resetFilters = () => {
    setAdvancedFilters(null);
    setSearch('');
    setStatusFilter('all');
    setReportedFilter('all');
  };

  // Update optimista de UN paquete (sin refetch)
  const patchPackageInList = useCallback((pkgId, patch) => {
    setPackages(prev => prev.map(p => p.id === pkgId ? { ...p, ...patch } : p));
  }, []);

  // Remueve un paquete de la lista (sin refetch)
  const removePackageFromList = useCallback((pkgId) => {
    setPackages(prev => prev.filter(p => p.id !== pkgId));
    setTotalFiltered(prev => Math.max(0, prev - 1));
  }, []);

  return {
    packages,
    loading,
    loadingMore,
    search, setSearch,
    statusFilter, setStatusFilter,
    reportedFilter, setReportedFilter,
    advancedFilters, setAdvancedFilters,
    totalFiltered,
    globalCounts,
    hasMore,
    loadPackages,
    resetFilters,
    patchPackageInList,
    removePackageFromList,
  };
}