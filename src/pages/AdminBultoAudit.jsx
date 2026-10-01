import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Search, History, Boxes, User, Package, RefreshCw, AlertTriangle, Download, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { CANONICAL_STATE_NAMES } from '@/components/utils/states';
import PageHero from '@/components/common/PageHero';
import BultoAuditCard from '@/components/admin/bulto-audit/BultoAuditCard';
import FixPackageCountsDialog from '@/components/admin/bulto-audit/FixPackageCountsDialog';
import BultoEditModal from '@/components/warehouse/BultoEditModal';
import { useBultoCodeSearch } from '@/hooks/useBultoCodeSearch';
import { matchesBultoCode, mergeBultos } from '@/lib/bultoSearch';

const SIN_ESTADO = 'Sin estado';

// Solo esta cuenta puede eliminar bultos (el backend lo valida también).
const DELETE_AUTHORIZED_EMAILS = ['genel.agonzalez@gmail.com'];

export default function AdminBultoAudit() {
  const [bultos, setBultos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [orderFilter, setOrderFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [clientStateMap, setClientStateMap] = useState({});
  const [showBackfill, setShowBackfill] = useState(false);
  const [backfillRunning, setBackfillRunning] = useState(false);
  const [showFixCounts, setShowFixCounts] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [canDelete, setCanDelete] = useState(false);

  // Los bultos que no están entre los cargados se buscan en el servidor por el final
  // del código de etiqueta (basta con los últimos caracteres).
  const { matches: codeMatches } = useBultoCodeSearch(search);

  const loadBultos = useCallback(async () => {
    try {
      const rows = await base44.entities.Bulto.list('-created_date', 500);
      setBultos(rows || []);
      resolveClientStates(rows || []);
    } catch {
      toast.error('No se pudo cargar el historial de bultos');
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadBultos();
      setLoading(false);
    })();
  }, [loadBultos]);

  // Permiso de borrado: solo la cuenta autorizada ve la acción de eliminar
  useEffect(() => {
    base44.auth.me()
      .then((u) => setCanDelete(DELETE_AUTHORIZED_EMAILS.includes((u?.email || '').toLowerCase())))
      .catch(() => setCanDelete(false));
  }, []);

  // Resuelve el estado (User.state) de cada cliente dueño de bulto.
  // Fuente principal: Bulto.client_snapshot.state (ya cargado en los bultos).
  // Fallback: getClientsByEmails (backend) para emails sin snapshot.
  const resolveClientStates = async (rows) => {
    const map = {};
    (rows || []).forEach((b) => {
      const email = (b.client_email || '').trim().toLowerCase();
      if (email && b.client_snapshot?.state) map[email] = b.client_snapshot.state;
    });
    const missing = Array.from(new Set(
      (rows || []).map((b) => (b.client_email || '').trim()).filter(Boolean)
    )).filter((e) => !map[e.toLowerCase()]);
    if (missing.length > 0) {
      try {
        const res = await base44.functions.invoke('getClientsByEmails', { emails: missing });
        const clients = res?.data?.clients || res?.clients || {};
        Object.entries(clients).forEach(([email, c]) => {
          if (c?.state) map[String(email).toLowerCase()] = c.state;
        });
      } catch (e) {
        console.warn('getClientsByEmails falló:', e);
      }
    }
    setClientStateMap(map);
  };

  // Resuelve el nombre legible del estado de un bulto de forma SINCRÓNICA:
  // 1) estado guardado en el propio bulto (client_snapshot.state)
  // 2) respaldo: mapa cargado desde los clientes (o getClientsByEmails)
  // Así la exportación nunca depende de que la carga en segundo plano termine.
  const resolveStateName = (bulto) => {
    const email = (bulto?.client_email || '').trim().toLowerCase();
    const raw = String(bulto?.client_snapshot?.state || clientStateMap[email] || '').trim();
    if (!raw) return '';
    return CANONICAL_STATE_NAMES[raw.toLowerCase()] || raw;
  };

  const employees = useMemo(() => {
    return Array.from(new Set(bultos.map((b) => b.created_by).filter(Boolean))).sort();
  }, [bultos]);

  const availableStates = useMemo(() => {
    const set = new Set();
    bultos.forEach((b) => {
      const email = (b.client_email || '').trim().toLowerCase();
      const st = clientStateMap[email];
      if (st) set.add(st);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [bultos, clientStateMap]);

  const filtered = useMemo(() => {
    const term = String(search || '').toLowerCase();
    const now = new Date();
    // Los bultos que la búsqueda por código encuentra en el servidor se suman a los
    // cargados, y luego pasan por los mismos filtros de la pantalla.
    const source = term && codeMatches.length ? mergeBultos(bultos, codeMatches) : bultos;
    return source.filter((b) => {
      const matchesEmployee = employeeFilter === 'all' || b.created_by === employeeFilter;
      if (!matchesEmployee) return false;

      if (stateFilter !== 'all') {
        const email = (b.client_email || '').trim().toLowerCase();
        const st = clientStateMap[email] || '';
        if (st !== stateFilter) return false;
      }

      const created = new Date(b.created_date);
      if (dateFilter === 'today') {
        const start = new Date(); start.setHours(0, 0, 0, 0);
        if (created < start) return false;
      } else if (dateFilter === '7d') {
        if (created < new Date(now.getTime() - 7 * 86400000)) return false;
      } else if (dateFilter === '30d') {
        if (created < new Date(now.getTime() - 30 * 86400000)) return false;
      }

      const hasOrder = Array.isArray(b.cbm_order_numbers) && b.cbm_order_numbers.length > 0;
      if (orderFilter === 'with' && !hasOrder) return false;
      if (orderFilter === 'without' && hasOrder) return false;

      if (!term) return true;
      const haystack = [
        b.label_code, b.client_email, b.shipping_mark, b.created_by,
        ...(b.package_trackings || []),
        ...(b.cbm_order_numbers || []),
      ].map((v) => String(v || '').toLowerCase()).join(' ');
      return haystack.includes(term) || matchesBultoCode(b.label_code, search);
    });
  }, [bultos, search, employeeFilter, dateFilter, orderFilter, stateFilter, clientStateMap, codeMatches]);

  const stats = useMemo(() => ({
    total: filtered.length,
    employees: new Set(filtered.map((b) => b.created_by).filter(Boolean)).size,
    packages: filtered.reduce((sum, b) => sum + (b.package_ids?.length || 0), 0),
  }), [filtered]);

  const exportTxt = () => {
    const byState = {};
    filtered.forEach((b) => {
      const state = resolveStateName(b) || SIN_ESTADO;
      if (!byState[state]) byState[state] = [];
      byState[state].push(b.label_code || '');
    });
    // Estados ordenados alfabéticamente; el grupo sin estado siempre al final.
    const groups = Object.keys(byState).filter((s) => s !== SIN_ESTADO).sort((a, b) => a.localeCompare(b, 'es'));
    if (byState[SIN_ESTADO]) groups.push(SIN_ESTADO);
    const sections = groups.map((state) => {
      const codes = byState[state];
      return `=== ${state.toUpperCase()} (${codes.length}) ===\n` + codes.join('\n');
    });
    const content = sections.join('\n\n');
    const blob = new Blob(['\ufeff' + content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria_bultos_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exportados ${filtered.length} registro(s) en ${groups.length} estado(s)`);
  };

  const runBackfill = async () => {
    setBackfillRunning(true);
    try {
      const res = await base44.functions.invoke('backfillBultosCerrados', {});
      const data = res?.data || res;
      const updated = data?.updated ?? 0;
      const toAlmacenVe = data?.to_almacen_ve ?? 0;
      const toDespachado = data?.to_despachado ?? 0;
      toast.success(
        updated > 0
          ? `${updated} bulto(s) corregido(s): ${toAlmacenVe} a Almacén Venezuela y ${toDespachado} a Despachado`
          : 'No había bultos en estado cerrado por corregir'
      );
      setShowBackfill(false);
      // Recargar lista para reflejar cambios
      await loadBultos();
    } catch (e) {
      toast.error('Error al ejecutar el backfill: ' + (e?.message || 'desconocido'));
    } finally {
      setBackfillRunning(false);
    }
  };

  const handleEditSaved = () => {
    setEditTarget(null);
    loadBultos();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await base44.functions.invoke('deleteBulto', { bulto_ids: [deleteTarget.id] });
      const data = res?.data;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      if ((data?.failed || []).length > 0) {
        toast.warning('No se pudo eliminar el bulto');
      } else {
        toast.success('Bulto eliminado');
      }
      setDeleteTarget(null);
      try { base44.invalidateEntityCache('Bulto'); } catch (_) {}
      await loadBultos();
    } catch (_) {
      toast.error('Error al eliminar bulto');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHero
        icon={History}
        badge="Auditoría de bultos"
        title="Historial de escaneos"
        description="Registro completo de qué empleado procesó cada bulto y a qué hora, con los paquetes incluidos."
      />

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          onClick={exportTxt}
          className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
          disabled={filtered.length === 0}
        >
          <Download className="h-4 w-4" /> Exportar TXT
        </Button>
        <Button
          variant="outline"
          onClick={() => setShowBackfill(true)}
          className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
        >
          <RefreshCw className="h-4 w-4" /> Corregir bultos cerrados
        </Button>
        <Button
          variant="outline"
          onClick={() => setShowFixCounts(true)}
          className="gap-2 border-sky-300 text-sky-700 hover:bg-sky-50"
        >
          <Boxes className="h-4 w-4" /> Corregir conteos de paquetes
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-0 shadow-lg">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="rounded-xl bg-blue-100 p-3"><Boxes className="h-6 w-6 text-blue-600" /></div>
            <div><p className="text-sm text-slate-500">Bultos procesados</p><p className="text-2xl font-bold text-slate-900">{stats.total}</p></div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="rounded-xl bg-violet-100 p-3"><User className="h-6 w-6 text-violet-600" /></div>
            <div><p className="text-sm text-slate-500">Empleados activos</p><p className="text-2xl font-bold text-slate-900">{stats.employees}</p></div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="rounded-xl bg-emerald-100 p-3"><Package className="h-6 w-6 text-emerald-600" /></div>
            <div><p className="text-sm text-slate-500">Paquetes escaneados</p><p className="text-2xl font-bold text-slate-900">{stats.packages}</p></div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl"><History className="h-5 w-5 text-blue-600" /> Historial de bultos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr,200px,160px,160px,160px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por etiqueta (últimos caracteres), cliente, shipping mark o tracking" className="pl-10" />
            </div>
            <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
              <SelectTrigger><SelectValue placeholder="Filtrar empleado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los empleados</SelectItem>
                {employees.map((email) => (
                  <SelectItem key={email} value={email}>{email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {availableStates.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger><SelectValue placeholder="Fecha" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo el historial</SelectItem>
                <SelectItem value="today">Hoy</SelectItem>
                <SelectItem value="7d">Últimos 7 días</SelectItem>
                <SelectItem value="30d">Últimos 30 días</SelectItem>
              </SelectContent>
            </Select>
            <Select value={orderFilter} onValueChange={setOrderFilter}>
              <SelectTrigger><SelectValue placeholder="N° de orden" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las órdenes</SelectItem>
                <SelectItem value="with">Con n° de orden</SelectItem>
                <SelectItem value="without">Sin n° de orden</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-500">
              {search.trim() ? 'Sin bultos con ese código.' : 'No hay bultos que coincidan con los filtros.'}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((b) => (
                <BultoAuditCard
                  key={b.id}
                  bulto={b}
                  stateName={resolveStateName(b)}
                  sinEstadoLabel={SIN_ESTADO}
                  canDelete={canDelete}
                  onEdit={() => setEditTarget(b)}
                  onDelete={() => setDeleteTarget(b)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo de confirmación de backfill */}
      <Dialog open={showBackfill} onOpenChange={(v) => !backfillRunning && setShowBackfill(v)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Corregir bultos cerrados
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-slate-600">
              Esta operación corrige los bultos que quedaron en estado{' '}
              <span className="font-mono font-semibold">cerrado</span>: los que ya tienen sus paquetes dentro de una
              orden de despacho pasan a <span className="font-mono font-semibold">despachado</span>, y el resto pasa a{' '}
              <span className="font-mono font-semibold">en_almacen_ve</span> (En Almacén Venezuela) para que aparezcan
              en <strong>Carga en almacén</strong> y puedan facturarse.
            </p>
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
              <strong>Advertencia:</strong> No cambia paquetes, números de orden ni facturas ya generadas. Puedes
              ejecutarla más de una vez: si no quedan bultos cerrados, no cambia nada.
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowBackfill(false)} disabled={backfillRunning}>
              Cancelar
            </Button>
            <Button onClick={runBackfill} disabled={backfillRunning} className="gap-2">
              {backfillRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {backfillRunning ? 'Ejecutando…' : 'Ejecutar backfill'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FixPackageCountsDialog
        open={showFixCounts}
        onClose={() => setShowFixCounts(false)}
        onDone={loadBultos}
      />

      {/* Modal de edición (reutiliza el del almacén) */}
      <BultoEditModal
        bulto={editTarget}
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={handleEditSaved}
      />

      {/* Confirmación de eliminación */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && !deleting && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" /> Eliminar bulto
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-slate-600 space-y-2">
            <p>
              ¿Seguro que deseas eliminar el{' '}
              <strong>Bulto {deleteTarget?.bulto_number}/{deleteTarget?.total_bultos}</strong>{' '}
              (<span className="font-mono break-all">{deleteTarget?.label_code}</span>)?
            </p>
            <p>Los paquetes quedarán libres para re-empacar. Los bultos restantes de cada cliente se renumerarán automáticamente.</p>
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