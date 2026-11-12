import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { buildFiscalQuery } from '@/lib/fiscalAdminQuery';
import { STATUS_META, STATUS_ORDER } from '@/lib/fiscalStatus';
import FiscalAdminTable from '@/components/fiscal/admin/FiscalAdminTable';

const PAGE = 40;
const EMPTY = { search: '', status: 'all', from: '', to: '' };

export default function FiscalAdminList({ onOpen, refreshKey }) {
  const [filters, setFilters] = useState(EMPTY);
  const [applied, setApplied] = useState(EMPTY);
  const [rows, setRows] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({});

  useEffect(() => {
    const t = setTimeout(() => setApplied(filters), 350);
    return () => clearTimeout(t);
  }, [filters]);

  const load = useCallback(async (append, nextCursor) => {
    setLoading(true);
    const page = await base44.entities.FiscalInvoiceRequest.filter(buildFiscalQuery(applied), {
      sort: '-created_date',
      limit: PAGE,
      ...(append && nextCursor ? { cursor: nextCursor } : {}),
    });
    setRows((prev) => (append ? [...prev, ...(page.items || [])] : page.items || []));
    setCursor(page.next_cursor || null);
    setHasMore(!!page.has_more);
    setLoading(false);
  }, [applied]);

  useEffect(() => { load(false); }, [load, refreshKey]);

  useEffect(() => {
    base44.entities.FiscalInvoiceRequest.aggregate({ groupBy: 'status' }).then((res) => {
      const map = {};
      (res?.rows || []).forEach((r) => { map[r.status] = r.count; });
      setCounts(map);
    }).catch(() => {});
  }, [refreshKey]);

  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {['all', ...STATUS_ORDER].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => set('status', s)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${filters.status === s ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:bg-accent'}`}
          >
            {s === 'all' ? 'Todas' : STATUS_META[s].label}{s !== 'all' && counts[s] ? ` (${counts[s]})` : ''}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_160px_160px_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input value={filters.search} onChange={(e) => set('search', e.target.value)} placeholder="Shipping Mark, factura, cliente, RIF o solicitud" />
        </div>
        <Input type="date" value={filters.from} onChange={(e) => set('from', e.target.value)} aria-label="Desde" />
        <Input type="date" value={filters.to} onChange={(e) => set('to', e.target.value)} aria-label="Hasta" />
        <Button type="button" variant="ghost" onClick={() => setFilters(EMPTY)}>Limpiar</Button>
      </div>
      {loading && !rows.length ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No hay solicitudes con esos filtros.</p>
      ) : (
        <FiscalAdminTable rows={rows} onOpen={onOpen} />
      )}
      {hasMore ? (
        <div className="text-center">
          <Button type="button" variant="outline" disabled={loading} onClick={() => load(true, cursor)}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Cargar más
          </Button>
        </div>
      ) : null}
    </div>
  );
}