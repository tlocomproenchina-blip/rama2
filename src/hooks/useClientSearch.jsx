import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { toast } from 'sonner';

/**
 * Búsqueda de clientes centralizada en el backend (listClientsForSupport).
 * Evita listar todos los usuarios desde el navegador, así funciona igual
 * para cualquier administrador o rol con acceso.
 */
export default function useClientSearch({ limit = 8, minLength = 2, exact = false } = {}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    const q = String(query || '').trim();
    if (q.length < minLength) {
      setResults([]);
      return;
    }
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await base44.functions.invoke('listClientsForSupport', {
          q,
          limit,
          includeCounts: false,
          exact,
        });
        setResults(res?.data?.data || []);
      } catch {
        setResults([]);
        toast.error('No se pudo buscar clientes. Intenta de nuevo.');
      }
      setSearching(false);
    }, 400);
    return () => clearTimeout(timeoutRef.current);
  }, [query, limit, minLength, exact]);

  return { query, setQuery, results, setResults, searching };
}