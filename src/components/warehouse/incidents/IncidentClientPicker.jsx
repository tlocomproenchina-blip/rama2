import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Loader2, Search, X } from 'lucide-react';

// Busca el cliente registrado y lo selecciona. Devuelve el cliente elegido para
// que el formulario guarde su email, su nombre y su código (shipping mark).
export default function IncidentClientPicker({ client, onSelect, onClear }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await base44.functions.invoke('searchBultoClients', { query: query.trim() });
        const data = res?.data || res || {};
        setResults(data.clients || []);
        setOpen(true);
      } catch (_) {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => timerRef.current && clearTimeout(timerRef.current);
  }, [query]);

  const pick = (item) => {
    onSelect(item);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  if (client) {
    return (
      <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{client.full_name || client.email}</p>
          <p className="truncate text-xs text-muted-foreground">
            {client.shipping_mark ? `Código ${client.shipping_mark}` : 'Sin código'} · {client.email}
          </p>
        </div>
        <button type="button" onClick={onClear} className="rounded-lg p-1 text-muted-foreground hover:bg-muted" aria-label="Quitar cliente">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar cliente por código, nombre, email o cédula…"
        className="pl-9 pr-9"
      />
      {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}

      {open && results.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-border bg-card shadow-lg">
          {results.map((item) => (
            <li key={item.email}>
              <button
                type="button"
                onClick={() => pick(item)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <span className="block font-medium text-foreground">{item.full_name || item.email}</span>
                <span className="block text-xs text-muted-foreground">
                  {item.shipping_mark ? `${item.shipping_mark} · ` : ''}{item.email}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && !loading && results.length === 0 && (
        <p className="absolute z-30 mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground shadow-lg">
          Ningún cliente coincide.
        </p>
      )}
    </div>
  );
}