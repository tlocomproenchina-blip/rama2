import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

// Búsqueda de clientes para las pantallas de Soporte (nombre, correo, cédula o
// Shipping Mark). Se pausa mientras haya un cliente seleccionado.
export default function useSupportClientSearch(selected) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const term = query.trim();

  useEffect(() => {
    if (selected || term.length < 3) {
      setResults([]);
      setTotal(0);
      setSearched(false);
      setSearching(false);
      return undefined;
    }

    let active = true;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await base44.functions.invoke('listClientsForSupport', {
          q: term,
          limit: 30,
          skip: 0,
          includeCounts: false,
        });
        if (!active) return;
        setResults(res?.data?.data || []);
        setTotal(Number(res?.data?.total) || 0);
        setSearched(true);
      } catch {
        if (!active) return;
        setResults([]);
        setTotal(0);
        setSearched(true);
        toast.error('No se pudo buscar clientes');
      } finally {
        if (active) setSearching(false);
      }
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [term, selected]);

  return { query, setQuery, results, total, searching, searched };
}