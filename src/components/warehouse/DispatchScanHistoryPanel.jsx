import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  History, Search, ScanLine, Package as PackageIcon, Boxes, MapPin,
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

// Panel reutilizable del historial de escaneos de despacho (DispatchScanLog).
// No incluye título de página h1 (se asume dentro de WarehouseDispatch).
export default function DispatchScanHistoryPanel({ title = 'Historial de escaneos' }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [resultFilter, setResultFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [clientStateMap, setClientStateMap] = useState({});

  // Resuelve el estado (User.state) de cada cliente en lote a partir de los
  // client_email presentes en los logs, usando la función backend existente
  // (getClientsByEmails) que usa $in desde el servidor. Cachea email→state.
  const resolveClientStates = useCallback(async (items) => {
    const emails = Array.from(new Set(
      (items || []).map((l) => (l.client_email || '').trim()).filter(Boolean)
    ));
    if (emails.length === 0) return;
    try {
      const res = await base44.functions.invoke('getClientsByEmails', { emails });
      const clients = res?.data?.clients || res?.clients || {};
      const map = {};
      Object.entries(clients).forEach(([email, c]) => {
        map[String(email).toLowerCase()] = c?.state || '';
      });
      setClientStateMap((prev) => ({ ...prev, ...map }));
    } catch (e) {
      console.warn('No se pudieron resolver estados de cliente:', e);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const items = await base44.entities.DispatchScanLog.list('-created_date', 200);
      setLogs(items || []);
      resolveClientStates(items || []);
    } catch (e) {
      console.error('Error loading scan logs:', e);
      toast.error('No se pudo cargar el historial de escaneos');
    } finally {
      setLoading(false);
    }
  }, [resolveClientStates]);

  useEffect(() => {
    loadLogs();
    const unsubscribe = base44.entities.DispatchScanLog.subscribe(() => {
      loadLogs();
    });
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, [loadLogs]);

  // Estados distintos presentes en los logs (derivados del mapa email→state)
  const availableStates = useMemo(() => {
    const set = new Set();
    logs.forEach((l) => {
      const email = (l.client_email || '').trim().toLowerCase();
      const st = clientStateMap[email];
      if (st) set.add(st);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [logs, clientStateMap]);

  // Filtrado en memoria
  const filtered = logs.filter((log) => {
    if (resultFilter !== 'all' && log.result !== resultFilter) return false;
    if (typeFilter !== 'all' && log.scan_type !== typeFilter) return false;
    if (stateFilter !== 'all') {
      const email = (log.client_email || '').trim().toLowerCase();
      const st = clientStateMap[email] || '';
      if (st !== stateFilter) return false;
    }
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
    <div className="space-y-4">
      {/* Encabezado de sección discreto */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <History className="h-4 w-4 text-blue-600" /> {title}
        </h2>
        <Button variant="ghost" size="sm" onClick={loadLogs} className="text-xs h-8">
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Actualizar
        </Button>
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
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="text-xs rounded-lg border border-border bg-card px-2.5 py-1.5 text-slate-700"
          >
            <option value="all">Todos los estados</option>
            {availableStates.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
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
            const clientEmail = (log.client_email || '').trim().toLowerCase();
            const clientState = clientEmail ? (clientStateMap[clientEmail] || '') : '';
            // Conteo de artículos: bulto usa package_count, paquete individual = 1
            const articleCount = log.scan_type === 'bulto' ? (log.package_count || 0) : 1;
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
                      <span className="truncate flex-1 min-w-0">{log.client_name || log.client_email}</span>
                      <Badge variant="outline" className="shrink-0 text-[9px] border-slate-200 text-slate-600 bg-slate-50 gap-0.5">
                        <MapPin className="h-2.5 w-2.5" />
                        {clientState || 'Sin estado'}
                      </Badge>
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

                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <Boxes className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span>{articleCount} artículo{articleCount !== 1 ? 's' : ''}{log.scan_type === 'bulto' ? ' en el bulto' : ''}</span>
                  </div>

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