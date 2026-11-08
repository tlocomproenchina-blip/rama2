import { useMemo } from 'react';
import { palletClientKey } from '@/lib/guidePallets';

// Clientes de los contenedores marcados, para anotar sus paletas antes de emitir.
export default function useOrderPalletClients(selected) {
  return useMemo(() => {
    const map = new Map();
    selected.forEach((order) => {
      const key = palletClientKey(order);
      const entry = map.get(key) || {
        key,
        client_email: order.client_email || '',
        client_name: order.client_name || '',
        shipping_mark: order.shipping_mark || '',
        bultos: 0,
      };
      entry.bultos += order.unregistered ? 1 : Number(order.bultos_total) || 0;
      map.set(key, entry);
    });
    return [...map.values()];
  }, [selected]);
}