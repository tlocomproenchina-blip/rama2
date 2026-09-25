import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Search, History, Boxes, User, Clock, Package, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import PageHero from '@/components/common/PageHero';

export default function AdminBultoAudit() {
  const [bultos, setBultos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [showBackfill, setShowBackfill] = useState(false);
  const [backfillRunning, setBackfillRunning] = useState(false);

  useEffect(() => {
    const loadBultos = async () => {
      setLoading(true);
      try {
        const rows = await base44.entities.Bulto.list('-created_date', 500);
        setBultos(rows || []);
      } catch {
        toast.error('No se pudo cargar el historial de bultos');
      }
      setLoading(false);
    };
    loadBultos();
  }, []);

  const employees = useMemo(() => {
    return Array.from(new Set(bultos.map((b) => b.created_by).filter(Boolean))).sort();
  }, [bultos]);

  const filtered = useMemo(() => {
    const term = String(search || '').toLowerCase();
    const now = new Date();
    return bultos.filter((b) => {
      const matchesEmployee = employeeFilter === 'all' || b.created_by === employeeFilter;
      if (!matchesEmployee) return false;

      const created = new Date(b.created_date);
      if (dateFilter === 'today') {
        const start = new Date(); start.setHours(0, 0, 0, 0);
        if (created < start) return false;
      } else if (dateFilter === '7d') {
        if (created < new Date(now.getTime() - 7 * 86400000)) return false;
      } else if (dateFilter === '30d') {
        if (created < new Date(now.getTime() - 30 * 86400000)) return false;
      }

      if (!term) return true;
      const haystack = [
        b.label_code, b.client_email, b.shipping_mark, b.created_by,
        ...(b.package_trackings || []),
      ].map((v) => String(v || '').toLowerCase()).join(' ');
      return haystack.includes(term);
    });
  }, [bultos, search, employeeFilter, dateFilter]);

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

      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={() => setShowBackfill(true)}
          className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
        >
          <RefreshCw className="h-4 w-4" /> Backfill bultos cerrados
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
          <div className="grid gap-3 md:grid-cols-[1fr,220px,180px]">
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
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger><SelectValue placeholder="Fecha" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo el historial</SelectItem>
                <SelectItem value="today">Hoy</SelectItem>
                <SelectItem value="7d">Últimos 7 días</SelectItem>
                <SelectItem value="30d">Últimos 30 días</SelectItem>
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
                          <Badge className={b.status === 'despachado' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
                            {b.status === 'despachado' ? 'Despachado' : 'Activo'}
                          </Badge>
                          {b.bulto_number > 0 && (
                            <Badge variant="outline" className="border-slate-200 text-slate-600">
                              Bulto {b.bulto_number}/{b.total_bultos || b.bulto_number}
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