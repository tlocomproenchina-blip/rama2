import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, History, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import PageHero from '@/components/common/PageHero';

function formatActionLabel(actionType) {
  return String(actionType || 'sin_accion')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function AdminEmployeeAudit() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionType, setActionType] = useState('all');

  useEffect(() => {
    const loadLogs = async () => {
      setLoading(true);
      try {
        const rows = await base44.entities.EmployeeAuditLog.list('-created_date', 300);
        setLogs(rows || []);
      } catch {
        toast.error('No se pudo cargar la auditoría');
      }
      setLoading(false);
    };

    loadLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    const term = String(search || '').toLowerCase();
    return logs.filter((log) => {
      const matchesAction = actionType === 'all' || log.action_type === actionType;
      const haystack = [
        log.actor_email,
        log.actor_name,
        log.target_email,
        log.target_name,
        log.summary,
        log.details,
        log.area_name,
      ].map((value) => String(value || '').toLowerCase()).join(' ');
      return matchesAction && (!term || haystack.includes(term));
    });
  }, [logs, search, actionType]);

  const actionOptions = useMemo(() => {
    return Array.from(new Set(logs.map((log) => log.action_type).filter(Boolean))).sort();
  }, [logs]);

  const stats = useMemo(() => ({
    total: logs.length,
    actors: new Set(logs.map((log) => log.actor_email).filter(Boolean)).size,
    modules: new Set(logs.map((log) => log.module_name).filter(Boolean)).size,
  }), [logs]);

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <PageHero
        icon={History}
        badge="Auditoría global del sistema"
        title="Auditoría de acciones"
        description="Revisa acciones realizadas por cualquier rol y en cualquier módulo para entender hábitos y actividad del equipo."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-0 shadow-lg"><CardContent className="p-5"><p className="text-sm text-slate-500">Registros</p><p className="mt-2 text-3xl font-bold text-slate-900">{stats.total}</p></CardContent></Card>
        <Card className="border-0 shadow-lg"><CardContent className="p-5"><p className="text-sm text-slate-500">Usuarios con actividad</p><p className="mt-2 text-3xl font-bold text-slate-900">{stats.actors}</p></CardContent></Card>
        <Card className="border-0 shadow-lg"><CardContent className="p-5"><p className="text-sm text-slate-500">Módulos auditados</p><p className="mt-2 text-3xl font-bold text-slate-900">{stats.modules}</p></CardContent></Card>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl"><ShieldCheck className="h-5 w-5 text-blue-600" /> Historial de auditoría</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr,240px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por actor, empleado, área o resumen" className="pl-10" />
            </div>
            <Select value={actionType} onValueChange={setActionType}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar acción" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las acciones</SelectItem>
                {actionOptions.map((value) => (
                  <SelectItem key={value} value={value}>{formatActionLabel(value)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-500">
              No hay registros de auditoría todavía.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredLogs.map((log) => (
                <Card key={log.id} className="border border-slate-100 bg-slate-50/60 shadow-sm">
                  <CardContent className="space-y-4 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-800">{log.summary}</h3>
                          <Badge className="bg-blue-100 text-blue-700">{formatActionLabel(log.action_type)}</Badge>
                          {log.area_name && <Badge variant="outline" className="border-cyan-200 text-cyan-700">{log.area_name}</Badge>}
                        </div>
                        <p className="text-sm text-slate-500">{new Date(log.created_date).toLocaleString('es-VE')}</p>
                      </div>
                      <div className="text-sm text-slate-600">
                        <span className="font-medium">Actor:</span> {log.actor_name || log.actor_email || 'Sistema'}
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <div className="rounded-xl bg-white p-3 shadow-sm">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Administrador</p>
                        <p className="mt-1 text-sm text-slate-700 break-all">{log.actor_email || '—'}</p>
                      </div>
                      <div className="rounded-xl bg-white p-3 shadow-sm">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Empleado / objetivo</p>
                        <p className="mt-1 text-sm text-slate-700 break-all">{log.target_name || log.target_email || '—'}</p>
                      </div>
                      <div className="rounded-xl bg-white p-3 shadow-sm">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Campos afectados</p>
                        <p className="mt-1 text-sm text-slate-700">{Array.isArray(log.changed_fields) && log.changed_fields.length > 0 ? log.changed_fields.join(', ') : '—'}</p>
                      </div>
                    </div>

                    {log.details && (
                      <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
                        {log.details}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}