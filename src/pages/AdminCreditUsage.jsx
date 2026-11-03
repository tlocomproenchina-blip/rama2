import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Zap, AlertTriangle, Filter } from 'lucide-react';
import { format } from 'date-fns';
import RuntimeBaselineCard from '@/components/api/RuntimeBaselineCard';

export default function AdminCreditUsage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [integrationFilter, setIntegrationFilter] = useState('all');
  const [rangeHours, setRangeHours] = useState(24);
  const [search, setSearch] = useState('');

  const loadLogs = async () => {
    setRefreshing(true);
    try {
      const sinceIso = new Date(Date.now() - rangeHours * 3600 * 1000).toISOString();
      const rows = await base44.entities.CreditUsageLog.filter(
        { occurred_at: { $gte: sinceIso } },
        '-occurred_at',
        500
      );
      setLogs(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.error('Error loading credit usage logs', e);
      setLogs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [rangeHours]);

  const integrations = useMemo(() => {
    const set = new Set();
    logs.forEach((l) => l.integration_name && set.add(l.integration_name));
    return Array.from(set).sort();
  }, [logs]);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (integrationFilter !== 'all' && l.integration_name !== integrationFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${l.caller_function || ''} ${l.caller_page || ''} ${l.user_email || ''} ${l.params_summary || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [logs, integrationFilter, search]);

  const stats = useMemo(() => {
    const total = filtered.reduce((s, l) => s + (Number(l.estimated_credits) || 1), 0);
    const errors = filtered.filter((l) => l.status === 'error').length;
    const byIntegration = {};
    const byCaller = {};
    const byPage = {};
    filtered.forEach((l) => {
      const c = Number(l.estimated_credits) || 1;
      byIntegration[l.integration_name] = (byIntegration[l.integration_name] || 0) + c;
      const caller = l.caller_function || '(desconocido)';
      byCaller[caller] = (byCaller[caller] || 0) + c;
      const page = l.caller_page || '(sin página)';
      byPage[page] = (byPage[page] || 0) + c;
    });
    const top = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 8);
    return {
      total,
      count: filtered.length,
      errors,
      byIntegration: top(byIntegration),
      byCaller: top(byCaller),
      byPage: top(byPage)
    };
  }, [filtered]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-amber-500" />
            Monitor de Créditos de Integración
          </h1>
          <p className="text-sm text-slate-600">
            Registra automáticamente cada llamada a integraciones de Base44 (InvokeLLM, SendEmail, UploadFile, GenerateImage, etc.)
          </p>
        </div>
        <Button onClick={loadLogs} disabled={refreshing} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      <RuntimeBaselineCard />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-slate-500">Créditos estimados</div>
            <div className="text-3xl font-bold text-amber-600">{stats.total}</div>
            <div className="text-xs text-slate-500 mt-1">{stats.count} llamadas registradas</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-slate-500">Integración más usada</div>
            <div className="text-lg font-semibold">
              {stats.byIntegration[0]?.[0] || '—'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {stats.byIntegration[0]?.[1] || 0} créditos
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-slate-500 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Errores
            </div>
            <div className="text-3xl font-bold text-rose-600">{stats.errors}</div>
            <div className="text-xs text-slate-500 mt-1">de {stats.count} llamadas</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select value={String(rangeHours)} onValueChange={(v) => setRangeHours(Number(v))}>
            <SelectTrigger><SelectValue placeholder="Rango" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Última hora</SelectItem>
              <SelectItem value="6">Últimas 6 horas</SelectItem>
              <SelectItem value="24">Últimas 24 horas</SelectItem>
              <SelectItem value="72">Últimos 3 días</SelectItem>
              <SelectItem value="168">Últimos 7 días</SelectItem>
            </SelectContent>
          </Select>

          <Select value={integrationFilter} onValueChange={setIntegrationFilter}>
            <SelectTrigger><SelectValue placeholder="Integración" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las integraciones</SelectItem>
              {integrations.map((i) => (
                <SelectItem key={i} value={i}>{i}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            placeholder="Buscar por función, página o usuario..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Top breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <BreakdownCard title="Por integración" items={stats.byIntegration} />
        <BreakdownCard title="Por función llamadora" items={stats.byCaller} />
        <BreakdownCard title="Por página" items={stats.byPage} />
      </div>

      {/* Tabla de logs */}
      <Card>
        <CardHeader>
          <CardTitle>Registros recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center text-slate-500 py-8">No hay registros para los filtros actuales.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-slate-500 border-b">
                  <tr>
                    <th className="text-left py-2 px-2">Fecha</th>
                    <th className="text-left py-2 px-2">Integración</th>
                    <th className="text-left py-2 px-2">Función llamadora</th>
                    <th className="text-left py-2 px-2">Página</th>
                    <th className="text-left py-2 px-2">Usuario</th>
                    <th className="text-left py-2 px-2">Duración</th>
                    <th className="text-left py-2 px-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 200).map((l) => (
                    <tr key={l.id} className="border-b hover:bg-slate-50">
                      <td className="py-2 px-2 whitespace-nowrap text-xs">
                        {l.occurred_at ? format(new Date(l.occurred_at), 'dd/MM HH:mm:ss') : '—'}
                      </td>
                      <td className="py-2 px-2">
                        <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                          {l.integration_name}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 font-mono text-xs">{l.caller_function || '—'}</td>
                      <td className="py-2 px-2 text-xs text-slate-600">{l.caller_page || '—'}</td>
                      <td className="py-2 px-2 text-xs">{l.user_email || '—'}</td>
                      <td className="py-2 px-2 text-xs">{l.duration_ms ? `${l.duration_ms}ms` : '—'}</td>
                      <td className="py-2 px-2">
                        {l.status === 'error' ? (
                          <Badge className="bg-rose-100 text-rose-700">Error</Badge>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-700">OK</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length > 200 && (
                <div className="text-xs text-slate-500 text-center mt-3">
                  Mostrando 200 de {filtered.length} registros
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BreakdownCard({ title, items }) {
  const total = items.reduce((s, [, v]) => s + v, 0) || 1;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-xs text-slate-500">Sin datos.</div>
        ) : (
          <ul className="space-y-2">
            {items.map(([name, value]) => (
              <li key={name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="truncate pr-2 font-medium">{name}</span>
                  <span className="text-slate-600">{value}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500"
                    style={{ width: `${(value / total) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}