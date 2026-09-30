import { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';

// Historial de guías de despacho: el rango de fechas, el estado de entrega y la
// búsqueda se resuelven en el servidor (listDispatchGuides) y aquí solo se
// acumulan las páginas.
const PAGE_SIZE = 40;

const startOfDayISO = (date) => (date ? `${date}T00:00:00.000Z` : '');
const endOfDayISO = (date) => (date ? `${date}T23:59:59.999Z` : '');

export function useDispatchGuideHistory({ enabled = true } = {}) {
  const [filters, setFilters] = useState({ from: '', to: '', search: '', status: 'all' });
  const [searchTerm, setSearchTerm] = useState('');
  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [pendingCount, setPendingCount] = useState(null);
  const [error, setError] = useState(null);
  const skipRef = useRef(0);
  const requestRef = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(filters.search.trim()), 500);
    return () => clearTimeout(timer);
  }, [filters.search]);

  const load = useCallback(async () => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('listDispatchGuides', {
        from: startOfDayISO(filters.from),
        to: endOfDayISO(filters.to),
        search: searchTerm,
        status: filters.status === 'all' ? '' : filters.status,
        limit: PAGE_SIZE,
        skip: 0,
      });
      if (requestRef.current !== requestId) return;
      const data = res?.data || res || {};
      setGuides(Array.isArray(data.guides) ? data.guides : []);
      setHasMore(!!data.has_more);
      skipRef.current = data.next_skip || 0;
      if (typeof data.pending_delivery_count === 'number') setPendingCount(data.pending_delivery_count);
    } catch (e) {
      if (requestRef.current !== requestId) return;
      setGuides([]);
      setHasMore(false);
      setError('No se pudo cargar el historial de guías.');
    } finally {
      if (requestRef.current === requestId) setLoading(false);
    }
  }, [filters.from, filters.to, filters.status, searchTerm]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await base44.functions.invoke('listDispatchGuides', {
        from: startOfDayISO(filters.from),
        to: endOfDayISO(filters.to),
        search: searchTerm,
        status: filters.status === 'all' ? '' : filters.status,
        limit: PAGE_SIZE,
        skip: skipRef.current,
      });
      const data = res?.data || res || {};
      setGuides((prev) => [...prev, ...(Array.isArray(data.guides) ? data.guides : [])]);
      setHasMore(!!data.has_more);
      if (typeof data.next_skip === 'number') skipRef.current = data.next_skip;
    } catch (_) {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, filters.from, filters.to, filters.status, searchTerm]);

  useEffect(() => {
    if (!enabled) return;
    load();
  }, [enabled, load]);

  return {
    guides,
    loading,
    loadingMore,
    hasMore,
    pendingCount,
    error,
    filters,
    setFilters,
    refresh: load,
    loadMore,
  };
}

export default useDispatchGuideHistory;