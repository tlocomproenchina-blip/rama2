import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Search, Loader2, X } from 'lucide-react';
import { piCall } from '@/lib/providerInvoicesApi';

export default function ProviderClientSearch({ value, onChange }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      const data = await piCall('searchClients', { query: q.trim() });
      setResults(data.clients || []);
      setLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-xl border bg-accent/50 px-4 py-3">
        <div>
          <p className="font-display font-semibold">{value.shipping_mark}</p>
          <p className="text-sm text-muted-foreground">{value.full_name}</p>
        </div>
        <button type="button" onClick={() => onChange(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
    );
  }
  return (
    <div className="relative">
      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por Shipping Mark o nombre" />
      {loading && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-primary" />}
      {results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border bg-card shadow-card">
          {results.map((c) => (
            <button type="button" key={c.email || c.shipping_mark} onClick={() => { onChange(c); setQ(''); setResults([]); }}
              className="block w-full px-4 py-2 text-left hover:bg-accent">
              <span className="font-semibold">{c.shipping_mark}</span> <span className="text-sm text-muted-foreground">· {c.full_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}