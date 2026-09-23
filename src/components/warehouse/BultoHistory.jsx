import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, Pencil, Trash2, Boxes, ChevronLeft, ChevronRight, Printer, CheckSquare, Square, X, Printer as PrinterIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import BultoEditModal from './BultoEditModal';
import BluetoothPrinter from './BluetoothPrinter';

const PAGE_SIZE = 50;

export default function BultoHistory({ refreshKey, onEditBulto }) {
  const [bultos, setBultos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [printTarget, setPrintTarget] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkPrintTarget, setBulkPrintTarget] = useState(null);

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

  const handleBulkPrint = useCallback(() => {
    const selected = bultos.filter((b) => selectedIds.has(b.id));
    if (!selected.length) return;
    setBulkPrintTarget(selected);
  }, [bultos, selectedIds]);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Cargar todos los bultos ordenados por fecha desc; filtramos en memoria
      const all = await base44.entities.Bulto.list('-created_date', 1000);
      let filtered = all || [];

      if (statusFilter !== 'all') {
        filtered = filtered.filter((b) => b.status === statusFilter);
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        filtered = filtered.filter((b) => {
          const sm = (b.shipping_mark || '').toLowerCase();
          const email = (b.client_email || '').toLowerCase();
          const name = (b.client_snapshot?.full_name || '').toLowerCase();
          const cedula = (b.client_snapshot?.cedula || '').toLowerCase();
          const label = (b.label_code || '').toLowerCase();
          return sm.includes(q) || email.includes(q) || name.includes(q) || cedula.includes(q) || label.includes(q);
        });
      }

      setTotal(filtered.length);
      const start = page * PAGE_SIZE;
      setBultos(filtered.slice(start, start + PAGE_SIZE));
    } catch (_) {
      toast.error('Error al cargar historial');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page, refreshKey]);

  useEffect(() => { load(); }, [load]);

  // Reset page al cambiar filtros
  useEffect(() => { setPage(0); }, [search, statusFilter]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await base44.functions.invoke('deleteBulto', { bulto_id: deleteTarget.id });
      if (res?.data?.error) {
        toast.error(res.data.error);
        return;
      }
      toast.success('Bulto eliminado');
      setDeleteTarget(null);
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

  const totalPages = Math.ceil(total / PAGE_SIZE);

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
                placeholder="Buscar por shipping mark, email, nombre, cédula o label…"
                className="pl-10"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">Todos los estados</option>
              <option value="activo">Activos</option>
              <option value="despachado">Despachados</option>
            </select>
          </div>
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
          <Button
            size="sm"
            onClick={handleBulkPrint}
            disabled={!selectedIds.size}
            className="ml-auto bg-blue-600 hover:bg-blue-700"
          >
            <PrinterIcon className="h-3.5 w-3.5" /> Imprimir ({selectedIds.size})
          </Button>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
      ) : bultos.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-slate-500">
          <Boxes className="h-10 w-10 mx-auto mb-2 text-slate-300" />
          No hay bultos que coincidan con los filtros.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {bultos.map((b) => (
            <Card key={b.id} className={`shadow-sm transition-all ${selectMode && selectedIds.has(b.id) ? 'ring-2 ring-blue-400 bg-blue-50/30' : ''}`}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`flex items-start gap-2 min-w-0 flex-1 ${selectMode ? 'cursor-pointer' : ''}`}
                    onClick={selectMode ? () => toggleSelect(b.id) : undefined}
                  >
                    {selectMode && (
                      <button onClick={(e) => { e.stopPropagation(); toggleSelect(b.id); }} className="mt-0.5 shrink-0">
                        {selectedIds.has(b.id)
                          ? <CheckSquare className="h-5 w-5 text-blue-600" />
                          : <Square className="h-5 w-5 text-slate-300" />}
                      </button>
                    )}
                    <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800">Bulto {b.bulto_number}/{b.total_bultos}</span>
                      <span className="text-xs font-mono text-slate-500 bg-muted px-1.5 py-0.5 rounded">{b.label_code}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        b.status === 'despachado' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {b.status === 'despachado' ? 'Despachado' : 'Activo'}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      <span className="font-medium">{b.client_snapshot?.full_name || '—'}</span>
                      {b.client_snapshot?.cedula && <span className="text-slate-400"> · C.I. {b.client_snapshot.cedula}</span>}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 mt-0.5">
                      <span className="font-mono">{b.shipping_mark}</span>
                      <span>{b.client_email}</span>
                      {b.client_snapshot?.state && <span>{b.client_snapshot.state}</span>}
                      <span>{b.package_trackings?.length || 0} paq.</span>
                      {b.invoice_paid ? (
                        <span className="text-green-600 font-medium">Factura pagada</span>
                      ) : (
                        <span className="text-red-600 font-medium">Factura pendiente</span>
                      )}
                    </div>
                  </div>
                  </div>
                  {!selectMode && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => setPrintTarget(b)}>
                        <Printer className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setEditTarget(b)}>
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setDeleteTarget(b)} className="text-red-600 hover:bg-red-50 hover:border-red-200">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
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

      {/* Modal de edición */}
      <BultoEditModal
        bulto={editTarget}
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={handleEditSaved}
      />

      {/* Reimpresión de etiqueta */}
      {printTarget && (
        <Dialog open onOpenChange={() => setPrintTarget(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Printer className="h-5 w-5" /> Reimprimir bulto {printTarget.bulto_number}/{printTarget.total_bultos}
              </DialogTitle>
            </DialogHeader>
            <div className="text-sm text-slate-600 space-y-2">
              <p>Etiqueta: <span className="font-mono">{printTarget.label_code}</span></p>
              <p>Cliente: {printTarget.client_snapshot?.full_name || printTarget.client_email}</p>
              <p>{printTarget.package_trackings?.length || 0} paquete(s) incluido(s).</p>
            </div>
            <BluetoothPrinter bultos={[printTarget]} onPrinted={() => setPrintTarget(null)} />
          </DialogContent>
        </Dialog>
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
            <BluetoothPrinter bultos={bulkPrintTarget} onPrinted={() => { setBulkPrintTarget(null); exitSelectMode(); }} />
          </DialogContent>
        </Dialog>
      )}

      {/* Confirmación de eliminación */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" /> Eliminar bulto
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-slate-600 space-y-2">
            <p>¿Seguro que deseas eliminar el <strong>Bulto {deleteTarget?.bulto_number}/{deleteTarget?.total_bultos}</strong> ({deleteTarget?.label_code})?</p>
            <p>Los paquetes quedarán libres para re-empacar. Los bultos restantes del cliente se renumerarán automáticamente.</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancelar</Button>
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