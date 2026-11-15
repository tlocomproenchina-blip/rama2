import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Search } from 'lucide-react';
import { regexFor, scopeFor, toRows } from '@/lib/wholesalerScope';

// Buscador de clientes de un solo mayorista para agregarlos a la factura.
export default function WholesalerClientSearch({ wholesalerKey, onPick }) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const rx = regexFor(q);
    if (!rx) { setRows([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      const filter = { $and: [scopeFor(wholesalerKey), { $or: [{ full_name: rx }, { email: rx }, { shipping_mark: rx }, { cedula: rx }] }] };
      setRows(toRows(await base44.entities.WholesalerClient.filter(filter, '-created_date', 8)));
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [q, wholesalerKey]);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente del mayorista por nombre, email, cédula o Shipping Mark…" className="h-11" />
      {loading && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-primary" />}
      {rows.length > 0 && (
        <div className="absolute z-20 mt-1 w-full divide-y overflow-hidden rounded-xl border bg-popover shadow-premium">
          {rows.map((c) => (
            <button key={c.id} onClick={() => { onPick(c); setQ(''); }} className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-accent">
              <span className="min-w-0"><span className="block truncate font-semibold">{c.full_name || c.email}</span><span className="block truncate text-xs text-muted-foreground">{c.shipping_mark || 'sin mark'} · {c.email}</span></span>
              <Plus className="h-4 w-4 shrink-0 text-primary" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}