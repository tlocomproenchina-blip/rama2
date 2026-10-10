import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';

// Bultos escaneados que todavía no están en ninguna guía: son los candidatos que el
// admin puede elegir a mano para emitir una guía. La búsqueda, el agrupado por
// cliente y los conteos los resuelve el backend (getDispatchGuides); aquí solo se
// acumulan las páginas que se piden.
//
// Nada se muestra hasta que el admin busca: sin búsqueda no se consulta ni se
// listan pendientes ('searched' queda en false).

const clientKeyOf = (client) => client?.client_key || client?.client_email || client?.client_name || '';

// Une una página nueva con lo ya cargado: si un cliente vuelve a aparecer se le
// suman sus bultos sin repetir ninguno.
function mergeClients(previous, incoming) {
  const map = new Map();
  [...previous, ...incoming].forEach((client) => {
    const key = clientKeyOf(client);
    if (!key) return;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...client, bultos: [...(client.bultos || [])] });
      return;
    }
    const seen = new Set(existing.bultos.map((b) => b.label_code));
    (client.bultos || []).forEach((bulto) => {
      if (!bulto?.label_code || seen.has(bulto.label_code)) return;
      seen.add(bulto.label_code);
      existing.bultos.push(bulto);
    });
  });
  return [...map.values()];
}

export default function useManualGuideCandidates() {
  const [search, setSearch] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextSkip, setNextSkip] = useState(0);

  const term = search.trim();

  const fetchPage = useCallback(async (term, skip) => {
    const res = await base44.functions.invoke('getDispatchGuides', { search: term, skip });
    const data = res?.data || res || {};
    return {
      clients: Array.isArray(data.clients) ? data.clients : [],
      hasMore: !!data.has_more,
      nextSkip: Number(data.next_skip) || 0,
    };
  }, []);

  useEffect(() => {
    // Sin búsqueda no hay nada que consultar ni que listar.
    if (!term) {
      setClients([]);
      setSearched(false);
      setHasMore(false);
      setNextSkip(0);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    // Pequeña espera para no consultar en cada tecla.
    const timer = setTimeout(async () => {
      try {
        const page = await fetchPage(term, 0);
        if (cancelled) return;
        setClients(page.clients);
        setHasMore(page.hasMore);
        setNextSkip(page.nextSkip);
        setSearched(true);
      } catch (_) {
        if (!cancelled) {
          setClients([]);
          setSearched(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, reloadKey, fetchPage]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchPage(term, nextSkip);
      setClients((prev) => mergeClients(prev, page.clients));
      setHasMore(page.hasMore);
      setNextSkip(page.nextSkip);
    } catch (_) {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, hasMore, loadingMore, nextSkip, term]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  return { search, setSearch, clients, loading, searched, loadingMore, hasMore, loadMore, reload };
}