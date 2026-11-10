import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { isOrphanBulto, loadClientReceiptIndex } from '@/lib/receiptFromBultos';

// Bultos del cliente en almacén sin recibo ni factura.
export default function useOrphanBultos(client, version = 0) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!client?.email) { setItems([]); return; }
    setLoading(true);
    try {
      const [bultos, index] = await Promise.all([
        base44.entities.Bulto.filter({ client_email: client.email, status: { $ne: 'despachado' } }, '-created_date', 300),
        loadClientReceiptIndex(client.email),
      ]);
      setItems(bultos.filter((b) => isOrphanBulto(b, index.codes, index.trackings)));
    } finally {
      setLoading(false);
    }
  }, [client?.email]);

  useEffect(() => { load(); }, [load, version]);

  return { items, loading, reload: load };
}