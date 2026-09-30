import { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { getAll } from '@/lib/offlineDb';
import { filterOrdersLocally, groupOrdersIntoGuideClients, mergeGuideClients } from '@/lib/dispatchGuides';

// Datos de la guía de despacho: el filtrado y los conteos se resuelven en el
// servidor (getDispatchGuides) y aquí solo se acumulan las páginas. Si no hay
// conexión, la guía se arma con los despachos guardados en el dispositivo.
const PAGE_SIZE = 60;

const startOfDayISO = (date) => (date ? `${date}T00:00:00.000Z` : '');
const endOfDayISO = (date) => (date ? `${date}T23:59:59.999Z` : '');

export function useDispatchGuides({ enabled = true } = {}) {
  const [filters, setFilters] = useState({ from: '', to: '', search: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState(null);
  const skipRef = useRef(0);
  const requestRef = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(filters.search.trim()), 500);
    return () => clearTimeout(timer);
  }, [filters.search]);

  // Ruta sin conexión: arma la guía con la caché local del almacén
  const loadFromCache = useCallback(async () => {
    const [orders, bultos, cachedClients] = await Promise.all([
      getAll('dispatch_orders').catch(() => []),
      getAll('bultos').catch(() => []),
      getAll('clients').catch(() => []),
    ]);
    const localOrders = filterOrdersLocally(orders, { from: filters.from, to: filters.to, search: searchTerm });
    const grouped = groupOrdersIntoGuideClients({ orders: localOrders, bultos, clients: cachedClients });
    setClients(grouped);
    setHasMore(false);
    setOffline(true);
  }, [filters.from, filters.to, searchTerm]);

  const load = useCallback(async () => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);
    setError(null);
    setOffline(false);
    try {
      const res = await base44.functions.invoke('getDispatchGuides', {
        from: startOfDayISO(filters.from),
        to: endOfDayISO(filters.to),
        search: searchTerm,
        limit: PAGE_SIZE,
        skip: 0,
      });
      if (requestRef.current !== requestId) return;
      const data = res?.data || res || {};
      setClients(Array.isArray(data.clients) ? data.clients : []);
      setHasMore(!!data.has_more);
      skipRef.current = data.next_skip || 0;
    } catch (e) {
      if (requestRef.current !== requestId) return;
      try {
        await loadFromCache();
      } catch (_) {
        setClients([]);
      }
      setError('Sin conexión: guía armada con los despachos guardados en el dispositivo.');
    } finally {
      if (requestRef.current === requestId) setLoading(false);
    }
  }, [filters.from, filters.to, searchTerm, loadFromCache]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await base44.functions.invoke('getDispatchGuides', {
        from: startOfDayISO(filters.from),
        to: endOfDayISO(filters.to),
        search: searchTerm,
        limit: PAGE_SIZE,
        skip: skipRef.current,
      });
      const data = res?.data || res || {};
      setClients((prev) => mergeGuideClients(prev, data.clients || []));
      setHasMore(!!data.has_more);
      if (typeof data.next_skip === 'number') skipRef.current = data.next_skip;
    } catch (_) {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, filters.from, filters.to, searchTerm]);

  // Grupos completos de los clientes marcados, para emitir la guía sin que
  // falte ningún bulto aunque la lista en pantalla esté paginada.
  const fetchGuideForClients = useCallback(
    async (emails) => {
      if (!Array.isArray(emails) || !emails.length) return [];
      const res = await base44.functions.invoke('getDispatchGuides', {
        from: startOfDayISO(filters.from),
        to: endOfDayISO(filters.to),
        client_emails: emails,
        skip: 0,
      });
      const data = res?.data || res || {};
      return Array.isArray(data.clients) ? data.clients : [];
    },
    [filters.from, filters.to]
  );

  useEffect(() => {
    if (!enabled) return;
    load();
  }, [enabled, load]);

  return {
    clients,
    loading,
    loadingMore,
    hasMore,
    offline,
    error,
    filters,
    setFilters,
    refresh: load,
    loadMore,
    fetchGuideForClients,
  };
}

export default useDispatchGuides;