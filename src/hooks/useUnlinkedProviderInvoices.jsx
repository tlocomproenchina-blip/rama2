import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { normCode } from '@/lib/receiptFromProviderInvoice';

// Facturas de proveedor del cliente que no tienen ningún recibo registrado con su N°.
export default function useUnlinkedProviderInvoices(client, version = 0) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!client?.email) { setItems([]); return; }
    setLoading(true);
    const queries = [base44.entities.ProviderInvoice.filter({ client_email: client.email }, '-created_date', 200)];
    if (client.shipping_mark) queries.push(base44.entities.ProviderInvoice.filter({ shipping_mark: client.shipping_mark }, '-created_date', 200));
    const [lists, receipts] = await Promise.all([
      Promise.all(queries),
      base44.entities.CbmIngreso.filter({ client_email: client.email }, '-fecha', 500),
    ]).finally(() => setLoading(false));
    const byId = new Map(lists.flat().map((p) => [p.id, p]));
    const codes = new Set((receipts || []).map((r) => normCode(r.invoice_number)).filter(Boolean));
    setItems([...byId.values()].filter((p) => p.invoice_code && !codes.has(normCode(p.invoice_code))));
  }, [client?.email, client?.shipping_mark]);

  useEffect(() => { load(); }, [load, version]);

  return { items, loading, remove: (id) => setItems((prev) => prev.filter((p) => p.id !== id)) };
}