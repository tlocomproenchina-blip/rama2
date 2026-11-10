import { useEffect, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';

const norm = (v) => String(v || '').trim().toUpperCase();

// Facturas de proveedor vinculadas a los recibos del cliente: mismo N° (contenedor)
// y mismo cliente (email o Shipping Mark). Devuelve { [receiptId]: providerInvoice }.
export default function useProviderInvoiceMatches(client, rows) {
  const [matches, setMatches] = useState({});
  const codesKey = rows.map((r) => norm(r.invoice_number)).filter((c) => c && c !== '—').sort().join('|');

  useEffect(() => {
    const codes = codesKey ? codesKey.split('|') : [];
    if (!client?.email || codes.length === 0) { setMatches({}); return; }
    let alive = true;
    const raw = rows.map((r) => String(r.invoice_number || '').trim()).filter(Boolean);
    base44.entities.ProviderInvoice.filter({ invoice_code: { $in: [...new Set([...raw, ...codes])] } }, '-created_date', 200)
      .then((list) => {
        if (!alive) return;
        const email = norm(client.email);
        const mark = norm(client.shipping_mark);
        const own = (list || []).filter((p) => norm(p.client_email) === email || (mark && norm(p.shipping_mark) === mark));
        const next = {};
        rows.forEach((r) => {
          const hit = own.find((p) => norm(p.invoice_code) === norm(r.invoice_number));
          if (hit) next[r.id] = hit;
        });
        setMatches(next);
      })
      .catch(() => alive && setMatches({}));
    return () => { alive = false; };
  }, [client?.email, client?.shipping_mark, codesKey]);

  return matches;
}