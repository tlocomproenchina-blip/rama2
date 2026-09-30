import { useEffect, useState } from 'react';
import { searchBultosByCode } from '@/lib/bultoSearch';

// Busca bultos por el final del código de etiqueta, con retardo para no consultar
// el servidor en cada tecla. La coincidencia la resuelve el servidor y se completa
// con los bultos que todavía están solo en este dispositivo.
export function useBultoCodeSearch(query, { limit = 50, delay = 300 } = {}) {
  const [matches, setMatches] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const term = String(query || '').trim();
    if (!term) {
      setMatches([]);
      setSearching(false);
      return undefined;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const found = await searchBultosByCode(term, { limit });
        if (!cancelled) setMatches(found);
      } catch (_) {
        if (!cancelled) setMatches([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, limit, delay]);

  return { matches, searching };
}

export default useBultoCodeSearch;