import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';

// Candidatos para emitir una guía con carga que puede no tener bulto registrado:
// órdenes / envíos sueltos ('orders') o las órdenes de una factura pagada
// ('invoices'). El cruce con los bultos registrados, el cliente y las guías
// anteriores lo resuelve el backend (getGuideSourceOrders); aquí solo se piden.
//
// Nada se muestra hasta que el admin busca: sin búsqueda no se consulta ni se
// listan candidatos ('searched' queda en false).
export default function useGuideOrderSources(intent) {
  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const term = search.trim();

  useEffect(() => {
    // Sin búsqueda no hay nada que consultar ni que listar.
    if (!term) {
      setOrders([]);
      setInvoices([]);
      setSearched(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    // Pequeña espera para no consultar en cada tecla.
    const timer = setTimeout(async () => {
      try {
        const res = await base44.functions.invoke('getGuideSourceOrders', { intent, search: term });
        const data = res?.data || res || {};
        if (cancelled) return;
        setOrders(Array.isArray(data.orders) ? data.orders : []);
        setInvoices(Array.isArray(data.invoices) ? data.invoices : []);
        setSearched(true);
      } catch (_) {
        if (!cancelled) {
          setOrders([]);
          setInvoices([]);
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
  }, [intent, term, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  return { search, setSearch, orders, invoices, loading, searched, reload };
}