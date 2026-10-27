import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Loader2, Search, X } from 'lucide-react';

// Buscador único del cliente: escribe shipping mark, tracking, email, teléfono
// o nombre y elige entre los clientes que coinciden. Al elegir uno, el código
// queda con su shipping mark y el cliente se asocia a la incidencia.
export default function IncidentClientSearch({ code, client, onCodeChange, onSelect, onClear }) {
  const [query, setQuery] = useState(code || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    setQuery(code || '');
  }, [code]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (client) {
      setResults([]);
      setOpen(false);
      return;
    }
    const value = query.trim();
    if (value.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await base44.functions.invoke('searchIncidentClients', { query: value });
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
  }, [query, client]);

  const handleChange = (event) => {
    const value = event.target.value;
    if (client) onClear();
    onCodeChange(value);
  };

  const pick = (item) => {
    onSelect(item);
    setQuery(item.shipping_mark || '');
    setResults([]);
    setOpen(false);
  };

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="incident-client"
          value={query}
          onChange={handleChange}
          placeholder="Shipping mark, tracking, email, teléfono o nombre…"
          autoComplete="off"
          className="pl-9 pr-9"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}

        {open && results.length > 0 && (
          <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-border bg-card shadow-lg">
            {results.map((item) => (
              <li key={item.email}>
                <button
                  type="button"
                  onClick={() => pick(item)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <span className="block font-medium text-foreground">{item.full_name || item.email}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.shipping_mark ? `${item.shipping_mark} · ` : ''}{item.email}
                    {item.whatsapp || item.phone ? ` · ${item.whatsapp || item.phone}` : ''}
                  </span>
                  <span className="mt-0.5 block text-[11px] uppercase tracking-wide text-primary">
                    Coincide por {(item.matched_by || []).join(', ')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {open && !loading && results.length === 0 && (
          <p className="absolute z-30 mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground shadow-lg">
            Ningún cliente coincide. Puedes registrar el código tal cual.
          </p>
        )}
      </div>

      {client ? (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{client.full_name || client.email}</p>
            <p className="truncate text-xs text-muted-foreground">
              {client.shipping_mark ? `Código ${client.shipping_mark}` : 'Sin código'} · {client.email}
              {client.whatsapp || client.phone ? ` · ${client.whatsapp || client.phone}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { onClear(); setQuery(''); }}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
            aria-label="Quitar cliente"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Busca por shipping mark, tracking, email, teléfono o nombre y elige al cliente de la lista.
        </p>
      )}
    </div>
  );
}