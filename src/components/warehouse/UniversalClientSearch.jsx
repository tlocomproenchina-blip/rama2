import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Loader2, Search, User, SearchX } from 'lucide-react';
import { searchClientsLocal } from '@/lib/offlineDb';

// Buscador universal con coincidencia parcial (shipping_mark, email, nombre, cédula, whatsapp).
// VERSIÓN OFFLINE-FIRST: busca en IndexedDB (instantáneo, 0ms servidor).
// Muestra un dropdown de sugerencias mientras el operador escribe (debounce 150ms).
// Al seleccionar un cliente, llama a onSelect con {email, shipping_mark, full_name, cedula, state, ...}.
export default function UniversalClientSearch({ onSelect, placeholder = 'Buscar por shipping mark, email, nombre o cédula…' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        // Búsqueda local en IndexedDB (instantánea)
        const clients = await searchClientsLocal(query.trim());
        setResults(clients);
        setOpen(true);
        setHighlight(-1);
      } catch (_) {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 150);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [query]);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const pick = (client) => {
    onSelect(client);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (!open || !results.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter' && highlight >= 0) {
      e.preventDefault();
      pick(results[highlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full z-30">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => results.length && setOpen(true)}
          placeholder={placeholder}
          className="pl-10"
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
        )}
      </div>
      {open && !loading && results.length === 0 && (
        <div className="absolute z-[100] mt-1 w-full rounded-lg border border-border bg-card shadow-premium max-h-80 overflow-y-auto">
          <div className="flex items-center gap-3 px-3 py-3 text-slate-400">
            <SearchX className="h-4 w-4 shrink-0" />
            <p className="text-sm">No se encontraron clientes para "{query}"</p>
          </div>
        </div>
      )}

      {open && results.length > 0 && (
        <div className="absolute z-[100] mt-1 w-full rounded-lg border border-border bg-card shadow-premium max-h-80 overflow-y-auto">
          {results.map((c, idx) => (
            <button
              key={c.email || c.id}
              type="button"
              onClick={() => pick(c)}
              onMouseEnter={() => setHighlight(idx)}
              className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors ${
                idx === highlight ? 'bg-accent' : 'hover:bg-muted/50'
              } ${idx > 0 ? 'border-t border-border/50' : ''}`}
            >
              <div className="mt-0.5 shrink-0 rounded-full bg-primary/10 p-1.5">
                <User className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">
                  {c.full_name || c.email}
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                  {c.shipping_mark && <span className="font-mono">{c.shipping_mark}</span>}
                  {c.cedula && <span>C.I. {c.cedula}</span>}
                  {c.state && <span>{c.state}</span>}
                </div>
                <p className="truncate text-xs text-slate-400">{c.email}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}