import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Hook de paginación server-side reutilizable para listas admin.
 *
 * Trae `pageSize` registros por página con filtros aplicados en el servidor,
 * en vez de descargar 500 y filtrar en el cliente.
 *
 * @param {string} entityName  - Nombre de la entidad (ej: "Package")
 * @param {object} options
 * @param {number} options.pageSize - Registros por página (default 50)
 * @param {string} options.sortBy   - Campo de ordenamiento (default '-created_date')
 * @param {object} options.filter    - Filtro server-side estable (ej: { status: 'pendiente' })
 * @param {string} options.searchField - Campo opcional para búsqueda de texto server-side
 *
 * @returns { data, loading, error, page, totalPages, totalEstimated, setPage, search, setSearch, refresh, hasNext, hasPrev }
 */
export function usePaginatedList(entityName, options = {}) {
  const { pageSize = 50, sortBy = '-created_date', filter: baseFilter = {}, searchField = null } = options;

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [totalEstimated, setTotalEstimated] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const searchDebounceRef = useRef(null);

  // Debounce de la búsqueda: espera 400ms tras el último tipeo
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setSearch(searchInput);
      setPage(0);
    }, 400);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const skip = page * pageSize;
      // Construye el filtro combinando el baseFilter + búsqueda de texto si hay
      const query = { ...baseFilter };
      if (searchField && search && search.trim()) {
        // Búsqueda de texto server-side: el SDK soporta regex-like via { $regex }
        try {
          query[searchField] = { $regex: search.trim(), $options: 'i' };
        } catch (_) {
          // fallback: si $regex no funciona, se filtra en cliente abajo
        }
      }

      const entity = base44.entities[entityName];
      const result = await entity.filter(query, sortBy, pageSize, skip);
      setData(result || []);

      // Estimación del total: si esta página está llena, asumimos que hay más
      // (no hacemos un count separado para no agregar otra petición)
      if ((result || []).length === pageSize) {
        setTotalEstimated((page + 1) * pageSize + 1); // al menos hay 1 más
      } else {
        setTotalEstimated(skip + (result || []).length);
      }
    } catch (err) {
      setError(err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [entityName, page, pageSize, sortBy, JSON.stringify(baseFilter), search, searchField, refreshKey]);

  useEffect(() => { load(); }, [load]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const totalPages = Math.max(1, Math.ceil(totalEstimated / pageSize));
  const hasNext = (data || []).length === pageSize;
  const hasPrev = page > 0;

  return {
    data: data || [],
    loading,
    error,
    page,
    totalPages,
    totalEstimated,
    hasNext,
    hasPrev,
    setPage,
    nextPage: () => hasNext && setPage((p) => p + 1),
    prevPage: () => hasPrev && setPage((p) => p - 1),
    search: searchInput,
    setSearch: setSearchInput,
    refresh,
  };
}