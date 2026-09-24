import { useState, useEffect, useCallback, useRef } from 'react';
import { bulkPut, getAll, clearStore } from '@/lib/offlineDb';

/**
 * Hook genérico para cachear una lista de entidades en IndexedDB.
 * - Al montar: sirve datos del cache inmediatamente (stale=true) y refresca en background.
 * - Si no hay cache, descarga bloqueando.
 * - Preserva registros locales (temp_*) durante el refresh para no perder trabajo en curso.
 *
 * @param {string} storeName - Nombre del store en IndexedDB
 * @param {function} fetcher - Función async que retorna el array fresco del servidor
 * @param {object} options - { ttl, deps }
 * @returns { data, loading, stale, lastSync, error, refresh }
 */
export function useOfflineEntityCache({ storeName, fetcher, ttl = 300000, deps = [] }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [error, setError] = useState(null);
  const fetchingRef = useRef(false);

  const doFetch = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const fresh = await fetcher();
      const items = Array.isArray(fresh) ? fresh : [];
      // Preservar registros locales (temp_*) antes de limpiar
      const local = await getAll(storeName);
      const localOnly = local.filter((item) =>
        String(item.id || '').startsWith('temp_') || item.is_local
      );
      await clearStore(storeName);
      await bulkPut(storeName, [...items, ...localOnly]);
      setData([...items, ...localOnly]);
      setStale(false);
      setLastSync(Date.now());
      setError(null);
    } catch (e) {
      setError(e?.message || 'Error al sincronizar');
      // Si hay cache, mantenerlo marcado como stale
      const cached = await getAll(storeName);
      if (cached.length > 0) {
        setData(cached);
        setStale(true);
      }
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, [fetcher, storeName]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Servir del cache inmediatamente
      const cached = await getAll(storeName);
      if (cancelled) return;
      if (cached.length > 0) {
        setData(cached);
        setLoading(false);
        setStale(true);
        // Refrescar en background
        doFetch();
      } else {
        // Sin cache: descargar bloqueando
        await doFetch();
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeName, ...deps]);

  const refresh = useCallback(() => doFetch(), [doFetch]);

  return { data, loading, stale, lastSync, error, refresh };
}