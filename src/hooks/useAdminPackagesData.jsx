import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { toast } from 'sonner';

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
        includeCounts: !append,
      });
      // Ignorar respuestas obsoletas (llegó una búsqueda más reciente)
      if (seq !== reqSeqRef.current) return;
      const pkgs = res?.data?.data || [];
      const total = res?.data?.total || 0;
      const counts = res?.data?.counts;
      if (append) {
        setPackages(prev => [...prev, ...pkgs]);
      } else {
        setPackages(pkgs);
        setTotalFiltered(total);
        if (counts) setGlobalCounts(counts);
      }
      setHasMore(res?.data?.hasMore || false);
    } catch (e) {
      console.error('Error loading packages:', e);
      toast.error('Error al cargar paquetes');
    }
    if (seq !== reqSeqRef.current) return;
    if (append) setLoadingMore(false); else setLoading(false);
  }, [debouncedSearch, statusFilter, reportedFilter, advancedFilters, pageSize]);

  // Recargar cuando cambien filtros o búsqueda
  useEffect(() => {
    loadPackages(false);
  }, [loadPackages]);

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