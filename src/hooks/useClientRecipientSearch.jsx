import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';

// Busca clientes para la selección personalizada de una campaña. Usa el mismo
// buscador del directorio (nombre, correo, teléfono, cédula, ciudad o Shipping
// Mark), así el admin encuentra al cliente igual que en el resto de la app.
const LIMIT = 30;

export default function useClientRecipientSearch(query) {
  const [state, setState] = useState({ clients: [], total: 0, loading: true });
  const reqRef = useRef(0);

  useEffect(() => {
    const term = String(query || '').trim();
    const timer = setTimeout(async () => {
      const myReq = ++reqRef.current;
      setState((prev) => ({ ...prev, loading: true }));
      try {
        const res = await base44.functions.invoke('listClientsForSupport', {
          q: term,
          limit: LIMIT,
          skip: 0,
          includeCounts: false,
        });
        if (myReq !== reqRef.current) return;
        setState({
          clients: res?.data?.data || [],
          total: Number(res?.data?.total) || 0,
          loading: false,
        });
      } catch {
        if (myReq === reqRef.current) setState({ clients: [], total: 0, loading: false });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  return { ...state, limit: LIMIT };
}