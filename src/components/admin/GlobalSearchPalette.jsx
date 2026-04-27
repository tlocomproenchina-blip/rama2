import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/components/api/ApiQueueManager';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { User as UserIcon, Package as PackageIcon, Hash, Loader2, Search, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { debounce } from 'lodash';

const HISTORY_KEY = 'tlec:global-search-history';
const HISTORY_LIMIT = 8;

const loadHistory = () => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveHistory = (items) => {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, HISTORY_LIMIT)));
  } catch {}
};

export default function GlobalSearchPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({ clients: [], packages: [], shippingMarks: [] });
  const [history, setHistory] = useState(() => loadHistory());
  const navigate = useNavigate();
  const reqIdRef = useRef(0);

  const pushHistory = useCallback((term) => {
    const t = (term || '').trim();
    if (t.length < 2) return;
    setHistory((prev) => {
      const next = [t, ...prev.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, HISTORY_LIMIT);
      saveHistory(next);
      return next;
    });
  }, []);

  const removeHistoryItem = useCallback((term, e) => {
    e?.stopPropagation?.();
    setHistory((prev) => {
      const next = prev.filter((x) => x !== term);
      saveHistory(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, []);

  // Toggle with Cmd/Ctrl + K
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const runSearch = useCallback(async (term) => {
    const trimmed = (term || '').trim();
    if (trimmed.length < 2) {
      setResults({ clients: [], packages: [], shippingMarks: [] });
      setLoading(false);
      return;
    }

    const myReq = ++reqIdRef.current;
    setLoading(true);
    const regex = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    try {
      const [byEmail, byName, byMark, byTracking, byShippingMark] = await Promise.all([
        base44.entities.User.filter({ email: { $regex: regex, $options: 'i' } }, '-updated_date', 5).catch(() => []),
        base44.entities.User.filter({ full_name: { $regex: regex, $options: 'i' } }, '-updated_date', 5).catch(() => []),
        base44.entities.User.filter({ shipping_mark: { $regex: regex, $options: 'i' } }, '-updated_date', 5).catch(() => []),
        base44.entities.Package.filter({ tracking_number: { $regex: regex, $options: 'i' } }, '-updated_date', 8).catch(() => []),
        base44.entities.Package.filter({ shipping_mark: { $regex: regex, $options: 'i' } }, '-updated_date', 8).catch(() => []),
      ]);

      if (myReq !== reqIdRef.current) return; // stale

      // Dedupe clients by id
      const clientMap = new Map();
      [...byEmail, ...byName, ...byMark].forEach((u) => { if (u?.id) clientMap.set(u.id, u); });

      // Dedupe packages by id
      const pkgMap = new Map();
      [...byTracking, ...byShippingMark].forEach((p) => { if (p?.id) pkgMap.set(p.id, p); });

      // Unique shipping marks from packages (separate group for clarity)
      const markSet = new Set();
      const shippingMarks = [];
      Array.from(pkgMap.values()).forEach((p) => {
        if (p.shipping_mark && !markSet.has(p.shipping_mark) && p.shipping_mark.toLowerCase().includes(trimmed.toLowerCase())) {
          markSet.add(p.shipping_mark);
          shippingMarks.push({ shipping_mark: p.shipping_mark, client_email: p.client_email });
        }
      });

      setResults({
        clients: Array.from(clientMap.values()).slice(0, 8),
        packages: Array.from(pkgMap.values()).slice(0, 10),
        shippingMarks: shippingMarks.slice(0, 5),
      });
    } catch (_) {
      setResults({ clients: [], packages: [], shippingMarks: [] });
    } finally {
      if (myReq === reqIdRef.current) setLoading(false);
    }
  }, []);

  const debouncedSearch = useRef(debounce(runSearch, 300)).current;

  useEffect(() => {
    debouncedSearch(query);
    return () => debouncedSearch.cancel?.();
  }, [query, debouncedSearch]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults({ clients: [], packages: [], shippingMarks: [] });
    }
  }, [open]);

  const goTo = (path) => {
    pushHistory(query);
    setOpen(false);
    setTimeout(() => navigate(path), 50);
  };

  const hasResults = results.clients.length || results.packages.length || results.shippingMarks.length;

  return (
    <>
      {/* Floating trigger button (visible on all admin pages) */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-5 z-40 gap-2 rounded-full shadow-premium bg-white/95 backdrop-blur border-slate-200 hover:bg-slate-50 lg:bottom-5"
        title="Buscar (Ctrl+K)"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Buscar</span>
        <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-slate-100 px-1.5 font-mono text-[10px] font-medium text-slate-600">
          ⌘K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Buscar cliente, tracking o shipping mark…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {loading && (
            <div className="flex items-center justify-center py-6 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Buscando…
            </div>
          )}

          {!loading && query.trim().length >= 2 && !hasResults && (
            <CommandEmpty>Sin resultados para "{query}"</CommandEmpty>
          )}

          {!loading && query.trim().length < 2 && history.length === 0 && (
            <div className="py-6 text-center text-xs text-slate-500 px-4">
              Escribe al menos 2 caracteres. Puedes buscar por nombre, email, tracking o shipping mark.
            </div>
          )}

          {!loading && query.trim().length < 2 && history.length > 0 && (
            <CommandGroup heading={
              <div className="flex items-center justify-between w-full">
                <span>Búsquedas recientes</span>
                <button
                  type="button"
                  onClick={clearHistory}
                  className="text-[10px] text-slate-400 hover:text-slate-600 uppercase tracking-wide"
                >
                  Limpiar
                </button>
              </div>
            }>
              {history.map((term) => (
                <CommandItem
                  key={`h-${term}`}
                  value={`history-${term}`}
                  onSelect={() => setQuery(term)}
                >
                  <Clock className="h-4 w-4 text-slate-400" />
                  <div className="flex-1 min-w-0 text-sm truncate">{term}</div>
                  <button
                    type="button"
                    onClick={(e) => removeHistoryItem(term, e)}
                    className="opacity-60 hover:opacity-100 p-1 rounded hover:bg-slate-100"
                    aria-label="Eliminar"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results.clients.length > 0 && (
            <CommandGroup heading="Clientes">
              {results.clients.map((u) => (
                <CommandItem
                  key={`c-${u.id}`}
                  value={`client-${u.id}-${u.email}-${u.full_name || ''}-${u.shipping_mark || ''}`}
                  onSelect={() => goTo(`${createPageUrl('AdminClients')}?q=${encodeURIComponent(u.email)}`)}
                >
                  <UserIcon className="h-4 w-4 text-sky-600" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{u.full_name || u.email}</div>
                    <div className="text-xs text-slate-500 truncate">
                      {u.email}{u.shipping_mark ? ` · ${u.shipping_mark}` : ''}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results.shippingMarks.length > 0 && (
            <CommandGroup heading="Shipping Marks">
              {results.shippingMarks.map((m) => (
                <CommandItem
                  key={`m-${m.shipping_mark}`}
                  value={`mark-${m.shipping_mark}`}
                  onSelect={() => goTo(`${createPageUrl('AdminPackages')}?shipping_mark=${encodeURIComponent(m.shipping_mark)}`)}
                >
                  <Hash className="h-4 w-4 text-violet-600" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{m.shipping_mark}</div>
                    {m.client_email && <div className="text-xs text-slate-500 truncate">{m.client_email}</div>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results.packages.length > 0 && (
            <CommandGroup heading="Paquetes / Tracking">
              {results.packages.map((p) => (
                <CommandItem
                  key={`p-${p.id}`}
                  value={`pkg-${p.id}-${p.tracking_number}-${p.shipping_mark || ''}`}
                  onSelect={() => goTo(`${createPageUrl('AdminPackages')}?tracking=${encodeURIComponent(p.tracking_number)}`)}
                >
                  <PackageIcon className="h-4 w-4 text-amber-600" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p.tracking_number}</div>
                    <div className="text-xs text-slate-500 truncate">
                      {p.shipping_mark || '—'}{p.client_email ? ` · ${p.client_email}` : ''}{p.status ? ` · ${p.status}` : ''}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}