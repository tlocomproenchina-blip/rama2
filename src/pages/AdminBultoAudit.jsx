import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Search, History, Boxes, User, Clock, Package, RefreshCw, AlertTriangle, Hash, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import PageHero from '@/components/common/PageHero';

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
  const [showEnAlmacenVeBackfill, setShowEnAlmacenVeBackfill] = useState(false);
  const [enAlmacenVeRunning, setEnAlmacenVeRunning] = useState(false);

  useEffect(() => {
    const loadBultos = async () => {
      setLoading(true);
      try {
        const rows = await base44.entities.Bulto.list('-created_date', 500);
        setBultos(rows || []);
        resolveClientStates(rows || []);
      } catch {
        toast.error('No se pudo cargar el historial de bultos');
      }
      setLoading(false);
      };
      loadBultos();
      // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

  // Resuelve el estado (User.state) de cada cliente dueño de bulto en lote,
  // usando la función backend existente (getClientsByEmails) con $in.
  const resolveClientStates = async (rows) => {
    const emails = Array.from(new Set(
      (rows || []).map((b) => (b.client_email || '').trim()).filter(Boolean)
    ));
    if (emails.length === 0) return;
    try {
      const res = await base44.functions.invoke('getClientsByEmails', { emails });
      const clients = res?.data?.clients || res?.clients || {};
      const map = {};
      Object.entries(clients).forEach(([email, c]) => {
        map[String(email).toLowerCase()] = c?.state || '';
      });
      setClientStateMap(map);
    } catch (e) {
      console.warn('No se pudieron resolver estados de cliente:', e);
    }
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
    return bultos.filter((b) => {
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
      return haystack.includes(term);
    });
  }, [bultos, search, employeeFilter, dateFilter, orderFilter, stateFilter, clientStateMap]);

  const stats = useMemo(() => ({
    total: filtered.length,
    employees: new Set(filtered.map((b) => b.created_by).filter(Boolean)).size,
    packages: filtered.reduce((sum, b) => sum + (b.package_ids?.length || 0), 0),
  }), [filtered]);

  const runBackfill = async () => {
    setBackfillRunning(true);
    try {
      const res = await base44.functions.invoke('backfillBultosCerrados', {});
      const updated = res?.data?.updated ?? res?.updated ?? 0;
      const alreadyOk = res?.data?.already_ok ?? res?.already_ok ?? 0;
      toast.success(`Backfill completado: ${updated} bulto(s) migrado(s) a 'cerrado'${alreadyOk ? `, ${alreadyOk} ya estaban correctos` : ''}`);
      setShowBackfill(false);
      // Recargar lista para reflejar cambios
      setLoading(true);
      const rows = await base44.entities.Bulto.list('-created_date', 500);
      setBultos(rows || []);
      setLoading(false);
    } catch (e) {
      toast.error('Error al ejecutar el backfill: ' + (e?.message || 'desconocido'));
    } finally {
      setBackfillRunning(false);
    }
  };

  const runEnAlmacenVeBackfill = async () => {
    setEnAlmacenVeRunning(true);
    try {
      const res = await base44.functions.invoke('backfillBultosEnAlmacenVe', {});
      const updated = res?.data?.updated ?? res?.updated ?? 0;
      const skipped = res?.data?.skipped ?? res?.skipped ?? 0;
      toast.success(`Migración completada: ${updated} bulto(s) migrado(s) a 'En Almacén Venezuela'${skipped ? `, ${skipped} ya tenían orden de despacho` : ''}`);
      setShowEnAlmacenVeBackfill(false);
      setLoading(true);
      const rows = await base44.entities.Bulto.list('-created_date', 500);
      setBultos(rows || []);
      setLoading(false);
    } catch (e) {
      toast.error('Error al ejecutar la migración: ' + (e?.message || 'desconocido'));
    } finally {
      setEnAlmacenVeRunning(false);
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
          onClick={() => setShowBackfill(true)}
          className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
        >
          <RefreshCw className="h-4 w-4" /> Backfill bultos cerrados
        </Button>
        <Button
          variant="outline"
          onClick={() => setShowEnAlmacenVeBackfill(true)}
          className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
        >
          <RefreshCw className="h-4 w-4" /> Migrar a En Almacén Venezuela
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
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por etiqueta, cliente, shipping mark o tracking" className="pl-10" />
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
              No hay bultos que coincidan con los filtros.
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((b) => (
                <Card key={b.id} className="border border-slate-100 bg-slate-50/60 shadow-sm">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-800 font-mono text-sm">{b.label_code}</h3>
                          <Badge className={
                            b.status === 'despachado' ? 'bg-emerald-100 text-emerald-700'
                            : b.status === 'en_almacen_ve' ? 'bg-amber-100 text-amber-700'
                            : b.status === 'cerrado' ? 'bg-slate-200 text-slate-600'
                            : 'bg-blue-100 text-blue-700'
                          }>
                            {b.status === 'despachado' ? 'Despachado' : b.status === 'en_almacen_ve' ? 'En Almacén Venezuela' : b.status === 'cerrado' ? 'Cerrado' : 'Activo'}
                          </Badge>
                          {b.bulto_number > 0 && (
                            <Badge variant="outline" className="border-slate-200 text-slate-600">
                              Bulto {b.bulto_number}/{b.total_bultos || b.bulto_number}
                            </Badge>
                          )}
                          {Array.isArray(b.cbm_order_numbers) && b.cbm_order_numbers.length > 0 && (
                            <Badge className="bg-blue-100 text-blue-700 gap-1">
                              <Hash className="h-3 w-3" /> {b.cbm_order_numbers.join(', ')}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(b.created_date).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                      </div>
                      <div className="text-sm text-slate-600 lg:text-right">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Procesado por</p>
                        <p className="font-medium break-all">{b.created_by || '—'}</p>
                      </div>
                    </div>

                    <div className="grid gap-2 md:grid-cols-3">
                      <div className="rounded-lg bg-white p-2.5 shadow-sm">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Cliente</p>
                        <p className="mt-0.5 text-sm text-slate-700 break-all">{b.client_email || '—'}</p>
                        {(() => {
                          const st = clientStateMap[(b.client_email || '').trim().toLowerCase()] || '';
                          return (
                            <span className="mt-1 inline-flex items-center gap-0.5 text-[11px] text-slate-500">
                              <MapPin className="h-3 w-3" /> {st || 'Sin estado'}
                            </span>
                          );
                        })()}
                      </div>
                      <div className="rounded-lg bg-white p-2.5 shadow-sm">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Shipping Mark</p>
                        <p className="mt-0.5 text-sm text-slate-700 font-mono">{b.shipping_mark || '—'}</p>
                      </div>
                      <div className="rounded-lg bg-white p-2.5 shadow-sm">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Paquetes ({b.package_ids?.length || 0})</p>
                        <p className="mt-0.5 text-xs text-slate-600 break-all">
                          {(b.package_trackings || []).slice(0, 3).join(', ')}
                          {(b.package_trackings || []).length > 3 && ` +${b.package_trackings.length - 3} más`}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo de confirmación - Migración a En Almacén Venezuela */}
      <Dialog open={showEnAlmacenVeBackfill} onOpenChange={(v) => !enAlmacenVeRunning && setShowEnAlmacenVeBackfill(v)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-blue-500" />
              Migrar bultos a "En Almacén Venezuela"
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-slate-600">
              Esta operación migrará los bultos con estado <span className="font-mono font-semibold">despachado</span> que
              NO tengan una orden de despacho asociada al nuevo estado <span className="font-mono font-semibold">en_almacen_ve</span> (En Almacén Venezuela).
            </p>
            <p className="text-sm text-slate-600">
              Los bultos que sí fueron despachados desde <span className="font-semibold">WarehouseDispatch</span> (con orden de despacho) se mantendrán como <span className="font-mono font-semibold">despachado</span>.
            </p>
            <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800">
              <strong>Nota:</strong> Esto corrige bultos cerrados antes de la implementación del estado intermedio que quedaron incorrectamente como "despachado".
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowEnAlmacenVeBackfill(false)} disabled={enAlmacenVeRunning}>
              Cancelar
            </Button>
            <Button onClick={runEnAlmacenVeBackfill} disabled={enAlmacenVeRunning} className="gap-2 bg-blue-600 hover:bg-blue-700">
              {enAlmacenVeRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {enAlmacenVeRunning ? 'Ejecutando…' : 'Ejecutar migración'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmación de backfill */}
      <Dialog open={showBackfill} onOpenChange={(v) => !backfillRunning && setShowBackfill(v)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Backfill de bultos cerrados
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-slate-600">
              Esta operación migrará los bultos legacy con estado <span className="font-mono font-semibold">activo</span> que
              no tengan paquetes activos asociados al estado <span className="font-mono font-semibold">cerrado</span> en el
              servidor.
            </p>
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
              <strong>Advertencia:</strong> Los bultos migrados dejarán de aparecer como abiertos en todos los
              dispositivos de bodega tras su próxima sincronización. Esta acción no se puede deshacer.
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
    </div>
  );
}