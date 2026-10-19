import { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const PAGE_SIZE = 30;

// Una carga ya tiene dueño cuando trae el correo o el shipping mark de su cliente:
// en cuanto se le asigna uno deja de ser huérfana y sale de esta lista.
export const hasOwner = (pkg) => !!String(pkg?.client_email || '').trim() || !!String(pkg?.shipping_mark || '').trim();

// Une la página nueva con la que ya estaba cargada, sin repetir cargas.
const mergeRows = (prev, next) => {
  const map = new Map();
  for (const row of [...prev, ...next]) map.set(row.id, row);
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.created_date || 0).getTime() - new Date(a.created_date || 0).getTime()
  );
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Filtro de la lista: cargas sin titular y, cuando hay búsqueda, su tracking o su
// shipping mark. La búsqueda se resuelve en el servidor.
function buildQuery(term) {
  const base = { is_orphan: true };
  const clean = String(term || '').trim();
  if (!clean) return base;
  const r = escapeRegex(clean);
  return {
    $and: [
      base,
      { $or: [{ tracking_number: { $regex: r, $options: 'i' } }, { shipping_mark: { $regex: r, $options: 'i' } }] },
    ],
  };
}

/**
 * Cargas recibidas sin titular para el panel de soporte: lista paginada del
 * servidor, búsqueda por tracking o shipping mark y salida inmediata de la carga
 * en cuanto queda asignada.
 */
export default function useOrphanPackages() {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const termRef = useRef('');
  const skipRef = useRef(0);

  const load = useCallback(async ({ term = '', skip = 0, append = false } = {}) => {
    termRef.current = term;
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const page = (await base44.entities.Package.filter(buildQuery(term), '-created_date', PAGE_SIZE, skip)) || [];
      // Solo huérfanos sin titular: la carga que ya tiene cliente asignado cumplió
      // su ciclo aquí y no vuelve a aparecer en esta lista.
      const clean = page.filter((p) => p?.id && !hasOwner(p));
      setRows((prev) => (append ? mergeRows(prev, clean) : clean));
      skipRef.current = skip + page.length;
      setHasMore(page.length === PAGE_SIZE);
    } catch (_) {
      if (!append) {
        setRows([]);
        setHasMore(false);
      }
      toast.error('No se pudieron cargar los paquetes sin cliente');
    }
    if (append) setLoadingMore(false); else setLoading(false);
  }, []);

  // Cada búsqueda reemplaza la lista por la del servidor.
  useEffect(() => {
    const timer = setTimeout(() => load({ term: search, skip: 0, append: false }), search ? 400 : 0);
    return () => clearTimeout(timer);
  }, [search, load]);

  // En tiempo real: la carga sale de la lista en cuanto se le asigna un cliente
  // (correo o shipping mark), desde este panel o desde cualquier otro.
  useEffect(() => {
    const unsubscribe = base44.entities.Package.subscribe((event) => {
      const data = event?.data;
      if (!data?.id) {
        if (event?.id) setRows((prev) => prev.filter((p) => p.id !== event.id));
        return;
      }
      if (data.is_orphan === true && !hasOwner(data)) {
        setRows((prev) => prev.map((p) => (p.id === data.id ? { ...p, ...data } : p)));
        return;
      }
      setRows((prev) => prev.filter((p) => p.id !== data.id));
    });
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, []);

  const loadMore = useCallback(
    () => load({ term: termRef.current, skip: skipRef.current, append: true }),
    [load]
  );
  const refresh = useCallback(() => load({ term: termRef.current, skip: 0, append: false }), [load]);
  const remove = useCallback((id) => setRows((prev) => prev.filter((p) => p.id !== id)), []);

  return { search, setSearch, rows, loading, loadingMore, hasMore, loadMore, refresh, remove };
}