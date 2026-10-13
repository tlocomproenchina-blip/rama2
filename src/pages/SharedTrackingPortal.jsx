import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import PortalHeader from '@/components/shared-portal/PortalHeader';
import PortalStats from '@/components/shared-portal/PortalStats';
import PortalFilterPanel from '@/components/shared-portal/PortalFilterPanel';
import PortalExportBar from '@/components/shared-portal/PortalExportBar';
import PortalTrackingTable from '@/components/shared-portal/PortalTrackingTable';
import PortalTrackingCards from '@/components/shared-portal/PortalTrackingCards';
import PortalAccessGate from '@/components/shared-portal/PortalAccessGate';
import { copyPortalRows, downloadPortalCsv, downloadPortalXlsx } from '@/lib/sharedPortalExport';

const PAGE_SIZE = 25;
const EMPTY_FILTERS = {
  q: '',
  estado: '',
  origen: '',
  cliente: '',
  wholesaler_key: '',
  registro_desde: '',
  registro_hasta: '',
  recepcion_desde: '',
  recepcion_hasta: '',
};

// Portal de Consulta Compartido: pantalla pública de solo lectura. Todo lo que
// se puede ver y exportar lo decide el servidor según el alcance del enlace.
export default function SharedTrackingPortal() {
  const { token } = useParams();
  const codeRef = useRef('');
  const [draft, setDraft] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [data, setData] = useState({ link: null, stats: null, rows: [], pagination: null, wholesalers: [] });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [gate, setGate] = useState({ required: false, error: '', checking: false });
  const [blocked, setBlocked] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [allFiltered, setAllFiltered] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [photoLoadingId, setPhotoLoadingId] = useState('');

  const invoke = useCallback(
    async (payload) => {
      const res = await base44.functions.invoke('sharedPortal', { token, ...payload });
      return res?.data || null;
    },
    [token]
  );

  // Foto con la que el cliente respaldó la entrega del vendedor. Es un archivo
  // privado: el servidor entrega un enlace temporal solo si ese tracking está
  // dentro del alcance de este enlace.
  const openPhoto = useCallback(
    async (row) => {
      setPhotoLoadingId(row.id);
      try {
        const data = await invoke({ action: 'photo', package_id: row.id });
        if (data?.url) window.open(data.url, '_blank', 'noopener,noreferrer');
        else toast.error(data?.error || 'No se pudo abrir la foto');
      } catch (err) {
        toast.error(err?.response?.data?.error || err?.message || 'No se pudo abrir la foto');
      }
      setPhotoLoadingId('');
    },
    [invoke]
  );

  const runQuery = useCallback(
    async ({ filters, cursor = null, append = false, accessCode }) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const payload = await invoke({
          action: 'query',
          code: accessCode ?? codeRef.current,
          filters,
          cursor,
          limit: PAGE_SIZE,
        });
        if (!payload?.ok) throw new Error(payload?.error || 'No se pudo consultar el portal');
        setBlocked('');
        setGate((prev) => ({ ...prev, required: false, error: '', checking: false }));
        setData((prev) => {
          const incoming = payload.rows || [];
          const rows = append
            ? [...prev.rows, ...incoming.filter((row) => !prev.rows.some((seen) => seen.id === row.id))]
            : incoming;
          return {
            link: payload.link,
            stats: payload.stats,
            wholesalers: payload.wholesalers || [],
            rows,
            pagination: payload.pagination,
          };
        });
        if (!append) {
          setSelected(new Set());
          setAllFiltered(false);
        }
      } catch (error) {
        const reason = error?.response?.data?.reason || '';
        const message = error?.response?.data?.error || error?.message || 'No se pudo consultar el portal';
        if (reason === 'codigo_requerido' || reason === 'codigo_incorrecto') {
          setGate({
            required: true,
            checking: false,
            error: reason === 'codigo_incorrecto' ? 'Código incorrecto. Vuelve a intentarlo.' : '',
          });
        } else {
          setBlocked(message);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [invoke]
  );

  useEffect(() => {
    runQuery({ filters: EMPTY_FILTERS });
  }, [runQuery]);

  const applyFilters = () => {
    setApplied(draft);
    runQuery({ filters: draft });
  };

  const clearFilters = () => {
    setDraft(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    runQuery({ filters: EMPTY_FILTERS });
  };

  const loadMore = () => {
    const cursor = data.pagination?.next_cursor;
    if (!cursor) return;
    runQuery({ filters: applied, cursor, append: true });
  };

  const toggleRow = (id) => {
    setAllFiltered(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleVisible = () => {
    setAllFiltered(false);
    setSelected((prev) => (data.rows.length > 0 && prev.size === data.rows.length ? new Set() : new Set(data.rows.map((row) => row.id))));
  };

  const handleExport = async (format) => {
    setExporting(true);
    try {
      const exportAll = allFiltered || selected.size === 0;
      let rows = [];
      let capped = false;
      if (exportAll) {
        const payload = await invoke({ action: 'export', code: codeRef.current, filters: applied, format });
        if (!payload?.ok) throw new Error(payload?.error || 'No se pudo exportar');
        rows = payload.rows || [];
        capped = !!payload.capped;
      } else {
        rows = data.rows.filter((row) => selected.has(row.id));
        await invoke({ action: 'log_export', code: codeRef.current, filters: applied, row_count: rows.length, format });
      }
      if (!rows.length) {
        toast.info('No hay registros para exportar con esos filtros');
        return;
      }
      if (format === 'xlsx') await downloadPortalXlsx(rows);
      else if (format === 'csv') downloadPortalCsv(rows);
      else await copyPortalRows(rows);
      toast.success(`Se exportaron ${rows.length.toLocaleString('es-VE')} registro(s)`);
      if (capped) toast.warning('La exportación llegó al tope del portal: acota los filtros para bajarla completa');
    } catch (error) {
      toast.error(error?.response?.data?.error || error?.message || 'No se pudo exportar');
    } finally {
      setExporting(false);
    }
  };

  if (gate.required) {
    return (
      <PortalAccessGate
        label={data.link?.label}
        error={gate.error}
        loading={gate.checking || loading}
        onSubmit={(value) => {
          codeRef.current = value;
          setGate((prev) => ({ ...prev, checking: true, error: '' }));
          runQuery({ filters: EMPTY_FILTERS, accessCode: value });
        }}
      />
    );
  }

  if (blocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md space-y-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <ShieldOff className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="font-display text-lg font-bold text-foreground">{blocked}</p>
          <p className="text-sm text-muted-foreground">Pídele a TLEC CARGO un enlace nuevo para seguir consultando.</p>
        </div>
      </div>
    );
  }

  if (loading && !data.link) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasMore = !!data.pagination?.has_more && !!data.pagination?.next_cursor;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 md:py-8">
        <PortalHeader link={data.link} />
        <PortalStats stats={data.stats} />
        <PortalFilterPanel
          draft={draft}
          onChange={setDraft}
          onApply={applyFilters}
          onClear={clearFilters}
          wholesalers={data.wholesalers}
          loading={loading}
        />
        <PortalExportBar
          selectedCount={selected.size}
          allFiltered={allFiltered}
          resultados={data.stats?.resultados}
          loadedCount={data.rows.length}
          onToggleAllFiltered={() => setAllFiltered((prev) => !prev)}
          onExport={handleExport}
          exporting={exporting}
        />
        <PortalTrackingTable
          rows={data.rows}
          selected={selected}
          onToggle={toggleRow}
          onToggleAll={toggleVisible}
          loading={loading}
          onOpenPhoto={openPhoto}
          photoLoadingId={photoLoadingId}
        />
        <PortalTrackingCards
          rows={data.rows}
          selected={selected}
          onToggle={toggleRow}
          loading={loading}
          onOpenPhoto={openPhoto}
          photoLoadingId={photoLoadingId}
        />

        {hasMore ? (
          <div className="flex justify-center">
            <Button type="button" variant="outline" onClick={loadMore} disabled={loadingMore} className="h-11">
              {loadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Cargar más resultados
            </Button>
          </div>
        ) : null}

        <footer className="flex flex-col items-center gap-1 pt-2 text-center text-xs text-muted-foreground">
          <p>Vista de solo lectura. Consulta y exporta con los filtros que definas.</p>
          <p>TLEC CARGO · Tu carga asegurada desde China hasta Venezuela</p>
        </footer>
      </div>
    </div>
  );
}