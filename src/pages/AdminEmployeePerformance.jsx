import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/components/api/ApiQueueManager';
import { ROLE_PRESETS } from '@/lib/rolePermissions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, BarChart3, History, Loader2 } from 'lucide-react';
import PageHero from '@/components/common/PageHero';
import PerformanceMetricCard from '@/components/employee-performance/PerformanceMetricCard';
import EmployeePerformanceChart from '@/components/employee-performance/EmployeePerformanceChart';
import EmployeePerformanceLeaderboard from '@/components/employee-performance/EmployeePerformanceLeaderboard';
import EmployeePerformanceAlertsPanel from '@/components/employee-performance/EmployeePerformanceAlertsPanel';
import EmployeePerformanceTable from '@/components/employee-performance/EmployeePerformanceTable';
import EmployeePerformanceDetail from '@/components/employee-performance/EmployeePerformanceDetail';
import PeriodFilter from '@/components/employee-performance/PeriodFilter';
import EmployeeOperationsPanel from '@/components/employee-performance/EmployeeOperationsPanel';
import { getTodayInCaracas, rangeForPreset, formatRangeLabel } from '@/lib/periodRange';

export default function AdminEmployeePerformance({ user }) {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [trackingEnabled, setTrackingEnabled] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [preset, setPreset] = useState('todo');
  const [custom, setCustom] = useState({ from: getTodayInCaracas(), to: getTodayInCaracas() });
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [operations, setOperations] = useState([]);
  const [opsLoading, setOpsLoading] = useState(true);
  const [opsError, setOpsError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedEmail, setSelectedEmail] = useState('');

  const range = useMemo(() => rangeForPreset(preset, custom), [preset, custom]);
  const rangeValid = range.from <= range.to;
  const rangeLabel = formatRangeLabel(range);

  useEffect(() => {
    if (!rangeValid) return undefined;
    let active = true;
    setOpsLoading(true);
    setOpsError('');
    base44.functions.invoke('getEmployeeOperations', { date: range.from, date_to: range.to })
      .then((res) => { if (active) setOperations(res?.data?.employees || []); })
      .catch(() => { if (active) { setOperations([]); setOpsError('No se pudo cargar el trabajo por empleado. Intenta de nuevo.'); } })
      .finally(() => { if (active) setOpsLoading(false); });
    return () => { active = false; };
  }, [range.from, range.to, rangeValid]);

  useEffect(() => {
    if (!rangeValid) return undefined;
    let active = true;
    const loadMetrics = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const res = await base44.functions.invoke('getEmployeePerformance', { date: range.from, date_to: range.to });
        if (!active) return;
        setMetrics(res?.data?.metrics || []);
        setAlerts(res?.data?.alerts || []);
        setTrackingEnabled(res?.data?.tracking_enabled !== false);
      } catch (error) {
        if (!active) return;
        setMetrics([]);
        setAlerts([]);
        setLoadError('No se pudieron cargar las métricas. Intenta de nuevo.');
      }
      if (active) setLoading(false);
    };
    loadMetrics();
    return () => { active = false; };
  }, [range.from, range.to, rangeValid]);

  const visibleOperations = useMemo(
    () => operations.filter((e) => employeeFilter === 'all' || e.email === employeeFilter),
    [operations, employeeFilter]
  );

  const filteredMetrics = useMemo(() => {
    const term = String(search || '').toLowerCase();
    return (metrics || []).filter((item) => {
      const matchesEmployee = employeeFilter === 'all' || item.employee_email === employeeFilter;
      const matchesRole = matchesEmployee && (roleFilter === 'all' || item.employee_role === roleFilter);
      const haystack = [item.employee_name, item.employee_email, item.employee_role].map((value) => String(value || '').toLowerCase()).join(' ');
      return matchesRole && (!term || haystack.includes(term));
    });
  }, [metrics, roleFilter, search, employeeFilter]);

  useEffect(() => {
    if (!filteredMetrics.length) {
      setSelectedEmail('');
      return;
    }
    if (!filteredMetrics.some((item) => item.employee_email === selectedEmail)) {
      setSelectedEmail(filteredMetrics[0].employee_email);
    }
  }, [filteredMetrics, selectedEmail]);

  const roleOptions = useMemo(() => Object.values(ROLE_PRESETS).map((role) => role.role_name), []);
  const selectedMetric = filteredMetrics.find((item) => item.employee_email === selectedEmail) || null;

  const summary = useMemo(() => {
    const totalActiveMs = filteredMetrics.reduce((sum, item) => sum + Number(item.total_active_time_ms || 0), 0);
    // Solo cuentan para la eficiencia los empleados con tiempo medido: sin él no hay porcentaje que promediar.
    const measured = filteredMetrics.filter((item) => Number(item.measured_time_ms || 0) > 0);
    const averageEfficiency = measured.length ? measured.reduce((sum, item) => sum + Number(item.active_efficiency_pct || 0), 0) / measured.length : 0;
    const reviewCount = filteredMetrics.filter((item) => item.needs_review).length;
    const topPerformer = [...filteredMetrics].sort((a, b) => (b.total_active_time_ms || 0) - (a.total_active_time_ms || 0))[0];
    return {
      totalEmployees: filteredMetrics.length,
      totalActiveHours: (totalActiveMs / 3600000).toFixed(1),
      averageEfficiency: averageEfficiency.toFixed(0),
      reviewCount,
      topPerformer: topPerformer?.employee_name || topPerformer?.employee_email || '—',
    };
  }, [filteredMetrics]);

  if (user?.role !== 'admin') {
    return <Card className="border-0 shadow-lg"><CardContent className="p-8 text-center text-slate-600">No tienes acceso a este panel.</CardContent></Card>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHero
        icon={BarChart3}
        badge="Rendimiento y hábitos del equipo"
        title="Dashboard de rendimiento de empleados"
        description="Analiza tiempo activo, eficiencia, sesiones, actividad por módulo y señales de seguimiento por empleado."
        actions={<Button asChild variant="outline"><Link to="/AdminEmployeeAudit"><History className="h-4 w-4" /> Ver auditoría</Link></Button>}
      />

      <Card className="border-0 shadow-lg">
        <CardContent className="grid gap-4 p-5 md:grid-cols-[1fr,280px]">
          <PeriodFilter preset={preset} onPresetChange={setPreset} custom={custom} onCustomChange={setCustom} />
          <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
            <SelectTrigger><SelectValue placeholder="Todos los empleados" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los empleados</SelectItem>
              {operations.map((e) => <SelectItem key={e.email} value={e.email}>{e.name} · {e.area_name}</SelectItem>)}
            </SelectContent>
          </Select>
          {!rangeValid && <p className="text-sm text-rose-600 md:col-span-2">La fecha inicial no puede ser posterior a la final.</p>}
        </CardContent>
      </Card>

      <EmployeeOperationsPanel employees={visibleOperations} loading={opsLoading} error={opsError} rangeLabel={rangeLabel} />

      {!trackingEnabled && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            El rastreo de actividad está desactivado, por eso no se registran datos nuevos. Actívalo en{' '}
            <Link to="/AdminSettings" className="font-semibold underline">Configuración</Link> (Rastreo de Actividad de Empleados) y guarda.
          </p>
        </div>
      )}
      {loadError && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{loadError}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
      <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <PerformanceMetricCard title="Empleados activos" value={summary.totalEmployees} subtitle="Con métricas de uso en el periodo seleccionado" accent="bg-blue-100 text-blue-700" />
        <PerformanceMetricCard title="Horas activas" value={summary.totalActiveHours} subtitle="Suma total del tiempo productivo" accent="bg-emerald-100 text-emerald-700" />
        <PerformanceMetricCard title="Eficiencia promedio" value={`${summary.averageEfficiency}%`} subtitle="Tiempo activo sobre tiempo medido" accent="bg-amber-100 text-amber-700" />
        <PerformanceMetricCard title="Revisión sugerida" value={summary.reviewCount} subtitle={`Mayor carga: ${summary.topPerformer}`} accent="bg-rose-100 text-rose-700" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <EmployeePerformanceChart metrics={filteredMetrics} />
        <EmployeePerformanceLeaderboard metrics={filteredMetrics} />
      </section>

      <EmployeePerformanceAlertsPanel alerts={alerts} />

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr,240px]">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, email o rol" />
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Todos los roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los roles</SelectItem>
              {roleOptions.map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <EmployeePerformanceTable metrics={filteredMetrics} selectedEmail={selectedEmail} onSelect={setSelectedEmail} />
        <EmployeePerformanceDetail metric={selectedMetric} />
      </section>
      </>
      )}
    </div>
  );
}