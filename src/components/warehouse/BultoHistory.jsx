import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, Trash2, Boxes, ChevronLeft, ChevronRight, Printer, CheckSquare, Square, X, Printer as PrinterIcon, Hash, Combine } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { getAll } from '@/lib/offlineDb';
import { base44 as apiQueue } from '@/components/api/ApiQueueManager';
import BultoEditModal from './BultoEditModal';
import BluetoothPrinter from './BluetoothPrinter';
import BulkOrderAssignDialog from './BulkOrderAssignDialog';
import { useBultoCodeSearch } from '@/hooks/useBultoCodeSearch';
import { matchesBultoCode, mergeBultos } from '@/lib/bultoSearch';
import { groupBultosByOrder } from '@/lib/bultoOrderGroups';
import BultoHistoryRow from './BultoHistoryRow';
import UnitKindFilter from './UnitKindFilter';
import BultoOrderGroupCard from './BultoOrderGroupCard';
import ReprintDialog from './ReprintDialog';
import CombineSelectedDialog from './CombineSelectedDialog';
import DismantleCajaDialog from './DismantleCajaDialog';

const PAGE_SIZE = 50;
const SERVER_BLOCK = 300;

// Solo esta cuenta puede eliminar bultos (el servidor lo valida también).
const DELETE_AUTHORIZED_EMAILS = ['genel.agonzalez@gmail.com'];

export default function BultoHistory({ refreshKey, onEditBulto }) {
  const [bultos, setBultos] = useState([]);
  const [entries, setEntries] = useState([]);
  const [entriesTotal, setEntriesTotal] = useState(0);
  const [expandedKeys, setExpandedKeys] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('all');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [deleteTargets, setDeleteTargets] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [printTarget, setPrintTarget] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkPrintTarget, setBulkPrintTarget] = useState(null);
  const [orderAssignOpen, setOrderAssignOpen] = useState(false);
  const [combineOpen, setCombineOpen] = useState(false);
  const [dismantleTarget, setDismantleTarget] = useState(null);
  const [serverLimit, setServerLimit] = useState(SERVER_BLOCK);
  const [hasOlder, setHasOlder] = useState(false);

  // Los bultos que no están entre los cargados se buscan en el servidor por el final
  // del código de etiqueta (basta con los últimos caracteres).
  const { matches: codeMatches } = useBultoCodeSearch(search);

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === bultos.length) return new Set();
      return new Set(bultos.map((b) => b.id));
    });
  }, [bultos]);

  // Desplegar / colapsar una tarjeta de grupo
  const toggleGroup = useCallback((key) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Marcar / desmarcar de una vez todos los bultos de una tarjeta de grupo
  const toggleGroupSelection = useCallback((groupBultos) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = groupBultos.every((b) => next.has(b.id));
      groupBultos.forEach((b) => (allSelected ? next.delete(b.id) : next.add(b.id)));
      return next;
    });
  }, []);

  const handleBulkPrint = useCallback(() => {
    const selected = bultos.filter((b) => selectedIds.has(b.id));
    if (!selected.length) return;
    setBulkPrintTarget(selected);
  }, [bultos, selectedIds]);

  const handleBulkDelete = useCallback(() => {
    const selected = bultos.filter((b) => selectedIds.has(b.id));
    if (!selected.length) return;
    setDeleteTargets(selected);
  }, [bultos, selectedIds]);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Cargar bultos del servidor ordenados por fecha desc
      // Búsqueda filtrada en el servidor; sin búsqueda se cargan los más recientes
      // por bloques ("Cargar bultos anteriores" amplía el bloque).
      const q = search.trim();
      const rx = q ? { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } : null;
      const serverQuery = rx
        ? { $or: ['shipping_mark', 'client_email', 'label_code', 'client_snapshot.full_name', 'client_snapshot.cedula', 'package_trackings', 'unregistered_codes'].map((f) => ({ [f]: rx })) }
        : {};
      if (kind === 'caja') serverQuery.is_caja = true;
      if (kind === 'suelto') serverQuery.is_caja = { $ne: true };
      const serverBultos = await base44.entities.Bulto.filter(serverQuery, '-created_date', serverLimit);
      setHasOlder(serverBultos.length >= serverLimit);

      // Cargar bultos locales cerrados/despachados que aún no se han sincronizado
      let localPending = [];
      try {
        const localAll = await getAll('bultos');
        localPending = localAll.filter(
          (b) => b.status !== 'activo' && b.closed_at && !b.synced && !b.server_bulto_id
        );
        // Normalizar campos para que coincidan con la estructura del servidor
        localPending = localPending.map((b) => ({
          ...b,
          id: b.id,
          is_local_pending: true,
          print_count: b.print_count || 0,
          created_date: b.closed_at || b.created_date || new Date().toISOString(),
        }));
      } catch (_) {}

      // Fusionar: locales primero (más recientes en dispositivo), luego servidor
      const serverIds = new Set(serverBultos.map((b) => b.id));
      const localNotInServer = localPending.filter((b) => !serverIds.has(b.server_bulto_id) && !serverBultos.some((s) => s.label_code === b.label_code));
      let filtered = [...localNotInServer, ...serverBultos]
        .filter((b) => kind === 'all' || (kind === 'caja' ? !!b.is_caja : !b.is_caja));

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        filtered = filtered.filter((b) => {
          const sm = (b.shipping_mark || '').toLowerCase();
          const email = (b.client_email || '').toLowerCase();
          const name = (b.client_snapshot?.full_name || '').toLowerCase();
          const cedula = (b.client_snapshot?.cedula || '').toLowerCase();
          const label = (b.label_code || '').toLowerCase();
          const codes = [...(b.package_trackings || []), ...(b.unregistered_codes || [])];
          return sm.includes(q) || email.includes(q) || name.includes(q) || cedula.includes(q)
            || label.includes(q) || matchesBultoCode(b.label_code, search)
            || codes.some((t) => String(t).toLowerCase().includes(q));
        });

        // La coincidencia por el final del código la resuelve el servidor, así
        // aparece el bulto aunque no esté entre los últimos cargados.
        if (codeMatches.length) {
          const kindMatches = codeMatches.filter((b) => kind === 'all' || (kind === 'caja' ? !!b.is_caja : !b.is_caja));
          filtered = mergeBultos(filtered, kindMatches);
        }
      }

      setTotal(filtered.length);

      // Agrupación por cliente + N° de contenedor: cada grupo es una tarjeta plegable y los
      // bultos sin N° de contenedor cuentan como una tarjeta individual cada uno.
      const grouped = groupBultosByOrder(filtered);
      setEntriesTotal(grouped.length);

      const start = page * PAGE_SIZE;
      const pageEntries = grouped.slice(start, start + PAGE_SIZE);
      setEntries(pageEntries);
      setBultos(pageEntries.flatMap((entry) => entry.bultos));
    } catch (_) {
      toast.error('Error al cargar historial');
    } finally {
      setLoading(false);
    }
  }, [search, page, refreshKey, codeMatches, serverLimit, kind]);

  // Permiso de borrado: solo la cuenta autorizada ve las acciones de eliminar
  useEffect(() => {
    base44.auth.me()
      .then((u) => setCanDelete(DELETE_AUTHORIZED_EMAILS.includes((u?.email || '').toLowerCase())))
      .catch(() => setCanDelete(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Reset page al cambiar la búsqueda
  useEffect(() => { setPage(0); }, [search, kind]);

  const confirmDelete = async () => {
    if (!deleteTargets.length) return;
    setDeleting(true);
    try {
      const res = await base44.functions.invoke('deleteBulto', { bulto_ids: deleteTargets.map((b) => b.id) });
      const data = res?.data;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      const okCount = data?.deleted_count ?? 0;
      const failedCount = (data?.failed || []).length;
      if (failedCount > 0) {
        toast.warning(`${okCount} bulto(s) eliminado(s), ${failedCount} con error`);
      } else {
        toast.success(okCount === 1 ? 'Bulto eliminado' : `${okCount} bultos eliminados`);
      }
      setDeleteTargets([]);
      exitSelectMode();
      try { apiQueue.invalidateEntityCache('Bulto'); } catch (_) {}
      load();
    } catch (_) {
      toast.error('Error al eliminar bulto');
    } finally {
      setDeleting(false);
    }
  };

  const handleEditSaved = (updatedBulto) => {
    setEditTarget(null);
    load();
  };

  const totalPages = Math.ceil(entriesTotal / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card className="shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por tracking, shipping mark, email, nombre, cédula o código…"
                className="pl-10"
              />
            </div>
          </div>
          <UnitKindFilter value={kind} onChange={setKind} />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500">{total} bulto(s) encontrado(s)</p>
            <Button
              variant={selectMode ? "default" : "outline"}
              size="sm"
              onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
            >
              {selectMode ? <X className="h-3.5 w-3.5" /> : <CheckSquare className="h-3.5 w-3.5" />}
              {selectMode ? 'Salir' : 'Seleccionar'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Barra de acciones de selección múltiple */}
      {selectMode && (
        <div className="sticky top-2 z-10 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/95 backdrop-blur p-2 shadow-sm">
          <Button variant="outline" size="sm" onClick={toggleSelectAll} disabled={!bultos.length}>
            {selectedIds.size === bultos.length && bultos.length > 0 ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
            {selectedIds.size === bultos.length && bultos.length > 0 ? 'Quitar todos' : 'Todos'}
          </Button>
          <span className="text-sm text-blue-700 font-medium">{selectedIds.size} seleccionado(s)</span>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCombineOpen(true)}
              disabled={selectedIds.size < 2}
            >
              <Combine className="h-3.5 w-3.5" /> Combinar ({selectedIds.size})
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setOrderAssignOpen(true)}
              disabled={!selectedIds.size}
            >
              <Hash className="h-3.5 w-3.5" /> N° de contenedor ({selectedIds.size})
            </Button>
            <Button
              size="sm"
              onClick={handleBulkPrint}
              disabled={!selectedIds.size}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <PrinterIcon className="h-3.5 w-3.5" /> Imprimir ({selectedIds.size})
            </Button>
            {canDelete && (
              <Button
                size="sm"
                variant="destructive"
                onClick={handleBulkDelete}
                disabled={!selectedIds.size}
              >
                <Trash2 className="h-3.5 w-3.5" /> Eliminar ({selectedIds.size})
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
      ) : entries.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-slate-500">
          <Boxes className="h-10 w-10 mx-auto mb-2 text-slate-300" />
          {search.trim() ? 'Sin bultos con ese código.' : 'No hay bultos que coincidan con los filtros.'}
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            entry.order ? (
              <BultoOrderGroupCard
                key={entry.key}
                entry={entry}
                expanded={selectMode || expandedKeys.has(entry.key)}
                onToggle={() => toggleGroup(entry.key)}
                selectMode={selectMode}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onToggleGroup={toggleGroupSelection}
                canDelete={canDelete}
                onPrint={setPrintTarget}
                onEdit={setEditTarget}
                onDelete={(bulto) => setDeleteTargets([bulto])}
              />
            ) : (
              <BultoHistoryRow
                key={entry.bultos[0].id}
                bulto={entry.bultos[0]}
                selectMode={selectMode}
                selected={selectedIds.has(entry.bultos[0].id)}
                onToggleSelect={toggleSelect}
                canDelete={canDelete}
                onPrint={setPrintTarget}
                onEdit={setEditTarget}
                onDelete={(bulto) => setDeleteTargets([bulto])}
              />
            )
          ))}
        </div>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
            <ChevronLeft className="h-4 w-4" /> Anterior
          </Button>
          <span className="text-sm text-slate-600">Página {page + 1} de {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
            Siguiente <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {hasOlder && !loading && page >= totalPages - 1 && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => setServerLimit((n) => n + SERVER_BLOCK)}>
            Cargar bultos anteriores
          </Button>
        </div>
      )}

      {/* Modal de edición */}
      <BultoEditModal
        bulto={editTarget}
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={handleEditSaved}
      />

      {/* Reimpresión de etiqueta con control de contador */}
      {printTarget && (
        <ReprintDialog
          bulto={printTarget}
          open={!!printTarget}
          onClose={() => setPrintTarget(null)}
          onRegistered={() => load()}
        />
      )}

      {/* Impresión múltiple */}
      {bulkPrintTarget && (
        <Dialog open onOpenChange={() => { setBulkPrintTarget(null); exitSelectMode(); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Printer className="h-5 w-5" /> Imprimir {bulkPrintTarget.length} etiqueta(s)
              </DialogTitle>
            </DialogHeader>
            <div className="text-sm text-slate-600 space-y-1">
              {bulkPrintTarget.map((b) => (
                <p key={b.id} className="font-mono text-xs">{b.label_code} — {b.client_snapshot?.full_name || b.client_email}</p>
              ))}
            </div>
            <BluetoothPrinter bultos={bulkPrintTarget} onPrinted={async () => {
              // Registrar cada impresión (best-effort)
              for (const b of bulkPrintTarget) {
                try {
                  await base44.functions.invoke('registerBultoPrint', { bulto_id: b.id });
                } catch (_) {}
              }
              setBulkPrintTarget(null);
              exitSelectMode();
              load();
            }} />
          </DialogContent>
        </Dialog>
      )}

      {/* Combinar las unidades seleccionadas en una sola */}
      <CombineSelectedDialog
        bultos={bultos.filter((b) => selectedIds.has(b.id))}
        open={combineOpen}
        onClose={() => {
          setCombineOpen(false);
          try { apiQueue.invalidateEntityCache('Bulto'); } catch (_) {}
          exitSelectMode();
          load();
        }}
      />

      {/* N° de contenedor para varios bultos a la vez */}
      <BulkOrderAssignDialog
        bultos={bultos.filter((b) => selectedIds.has(b.id))}
        open={orderAssignOpen}
        onClose={() => setOrderAssignOpen(false)}
        onDone={() => {
          try { apiQueue.invalidateEntityCache('Bulto'); } catch (_) {}
          exitSelectMode();
          load();
        }}
      />

      {/* Confirmación de eliminación */}
      <Dialog open={deleteTargets.length > 0} onOpenChange={(o) => !o && setDeleteTargets([])}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" /> {deleteTargets.length === 1 ? 'Eliminar bulto' : `Eliminar ${deleteTargets.length} bultos`}
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-slate-600 space-y-2">
            {deleteTargets.length === 1 ? (
              <p>¿Seguro que deseas eliminar el <strong>Bulto {deleteTargets[0].bulto_number}/{deleteTargets[0].total_bultos}</strong> ({deleteTargets[0].label_code})?</p>
            ) : (
              <>
                <p>¿Seguro que deseas eliminar <strong>{deleteTargets.length} bultos</strong>?</p>
                <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-muted/40 p-2 space-y-0.5">
                  {deleteTargets.map((b) => (
                    <p key={b.id} className="font-mono text-xs break-all">{b.label_code}</p>
                  ))}
                </div>
              </>
            )}
            <p>Los paquetes quedarán libres para re-empacar. Los bultos restantes de cada cliente se renumerarán automáticamente.</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTargets([])} disabled={deleting}>Cancelar</Button>
            <Button onClick={confirmDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}