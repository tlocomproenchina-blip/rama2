import { useCallback, useMemo, useState } from 'react';

const num = (value) => Number(value) || 0;

// Contenedores marcados para la guía, más el resumen de lo que se va a emitir.
export default function useGuideOrderSelection() {
  const [selected, setSelected] = useState(() => new Map());

  const toggle = useCallback((order) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(order.key)) next.delete(order.key);
      else next.set(order.key, order);
      return next;
    });
  }, []);

  // Marca o desmarca de golpe las órdenes de una factura.
  const toggleMany = useCallback((orders) => {
    const list = (orders || []).filter((order) => !order?.already_in_guide);
    setSelected((prev) => {
      const next = new Map(prev);
      const allSelected = list.length > 0 && list.every((order) => next.has(order.key));
      list.forEach((order) => (allSelected ? next.delete(order.key) : next.set(order.key, order)));
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Map()), []);

  const summary = useMemo(() => {
    const clients = new Set();
    let orders = 0;
    let bultos = 0;
    let packages = 0;
    let cbm = 0;
    let unregistered = 0;

    selected.forEach((order) => {
      orders += 1;
      bultos += num(order.bultos_total);
      packages += num(order.packages_total);
      cbm += num(order.cbm_total);
      if (order.unregistered) unregistered += 1;
      clients.add(order.client_email || order.key);
    });

    return { clients: clients.size, orders, bultos, packages, cbm: Number(cbm.toFixed(4)), unregistered };
  }, [selected]);

  return { selected, toggle, toggleMany, clear, summary };
}