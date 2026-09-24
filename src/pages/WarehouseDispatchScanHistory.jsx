import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  History, Search, ScanLine, Truck, Package as PackageIcon, Boxes,
  CheckCircle2, AlertTriangle, XCircle, User, Clock, RefreshCw, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

const RESULT_CONFIG = {
  dispatched: { label: 'Despachado', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  already_dispatched: { label: 'Ya despachado', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  found: { label: 'Encontrado', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Search },
  not_found: { label: 'No encontrado', color: 'bg-rose-100 text-rose-700 border-rose-200', icon: XCircle },
  error: { label: 'Error', color: 'bg-rose-100 text-rose-700 border-rose-200', icon: AlertTriangle },
};

const SCAN_TYPE_CONFIG = {
  bulto: { label: 'Bulto', icon: Boxes },
  package: { label: 'Paquete', icon: PackageIcon },
  not_found: { label: 'No encontrado', icon: XCircle },
};

export default function WarehouseDispatchScanHistory({ user }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [resultFilter, setResultFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const items = await base44.entities.DispatchScanLog.list('-created_date', 200);
      setLogs(items || []);
    } catch (e) {
      console.error('Error loading scan logs:', e);
      toast.error('No se pudo cargar el historial de escaneos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
    const unsubscribe = base44.entities.DispatchScanLog.subscribe(() => {
      loadLogs();
    });
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, [loadLogs]);

  // Filtrado en memoria
  const filtered = logs.filter((log) => {
    if (resultFilter !== 'all' && log.result !== resultFilter) return false;
    if (typeFilter !== 'all' && log.scan_type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const haystack = [
        log.scanned_code, log.client_name, log.client_email,
        log.shipping_mark, log.tracking_number, log.bulto_label_code,
        log.scanned_by,
      ].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  // Stats rápidas
  const stats = {
    total: logs.length,
    dispatched: logs.filter((l) => l.result === 'dispatched').length,
    already: logs.filter((l) => l.result === 'already_dispatched').length,
    not_found: logs.filter((l) => l.result === 'not_found').length,
  };

  const formatDate = (d) => {
    if (!d) return '';
    try {
      return new Date(d).toLocaleString('es-VE', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return d; }
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <ScanLine className="h-6 w-6 text-blue-600" /> Historial de Escaneos de Despacho
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Registro de todos los códigos escaneados desde la página de Despacho por Escaneo.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
          <p className="text-[11px] text-slate-500">Total escaneos</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-emerald-600">{stats.dispatched}</p>
          <p className="text-[11px] text-slate-500">Despachados</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-amber-600">{stats.already}</p>
          <p className="text-[11px] text-slate-500">Ya despachados</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-rose-600">{stats.not_found}</p>
          <p className="text-[11px] text-slate-500">No encontrados</p>
        </CardContent></Card>
      </div>

      {/* Filtros */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <Input
            placeholder="Buscar por código, cliente, tracking, mark…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={resultFilter}
            onChange={(e) => setResultFilter(e.target.value)}
            className="text-xs rounded-lg border border-border bg-card px-2.5 py-1.5 text-slate-700"
          >
            <option value="all">Todos los resultados</option>
            <option value="dispatched">Despachados</option>
            <option value="already_dispatched">Ya despachados</option>
            <option value="found">Encontrados</option>
            <option value="not_found">No encontrados</option>
            <option value="error">Error</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs rounded-lg border border-border bg-card px-2.5 py-1.5 text-slate-700"
          >
            <option value="all">Todos los tipos</option>
            <option value="bulto">Bultos</option>
            <option value="package">Paquetes</option>
            <option value="not_found">No encontrados</option>
          </select>
          <Button variant="ghost" size="sm" onClick={loadLogs} className="text-xs h-8 ml-auto">
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Actualizar
          </Button>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <ScanLine className="h-10 w-10 mx-auto mb-2" />
          <p className="text-sm">
            {logs.length === 0 ? 'Aún no hay escaneos registrados.' : 'No hay resultados para los filtros seleccionados.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => {
            const rc = RESULT_CONFIG[log.result] || RESULT_CONFIG.found;
            const tc = SCAN_TYPE_CONFIG[log.scan_type] || SCAN_TYPE_CONFIG.package;
            const ResultIcon = rc.icon;
            const TypeIcon = tc.icon;
            return (
              <Card key={log.id} className="overflow-hidden">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className={`shrink-0 rounded-lg p-1.5 ${rc.color}`}>
                        <ResultIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-semibold text-slate-800 break-all">
                          {log.scanned_code || '(sin código)'}
                        </p>
                        <p className="text-[11px] text-slate-500">{formatDate(log.created_date)}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant="outline" className={rc.color}>
                        {rc.label}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <TypeIcon className="h-3 w-3 text-slate-400" />
                        <span className="text-[10px] text-slate-500">{tc.label}</span>
                      </div>
                    </div>
                  </div>

                  {(log.client_name || log.client_email) && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">{log.client_name || log.client_email}</span>
                    </div>
                  )}

                  {log.shipping_mark && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-slate-400">Mark:</span>
                      <span className="font-mono font-semibold text-blue-700">{log.shipping_mark}</span>
                    </div>
                  )}

                  {log.tracking_number && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      <PackageIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="font-mono break-all">{log.tracking_number}</span>
                    </div>
                  )}

                  {log.scan_type === 'bulto' && log.package_count > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      <Boxes className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span>{log.package_count} paquete(s) en el bulto</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
                    <span className="text-[10px] text-slate-400 truncate">
                      {log.scanned_by || '—'}
                    </span>
                    {log.offline && (
                      <Badge variant="outline" className="text-[9px] border-slate-200 text-slate-500 bg-slate-50">
                        Offline
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}