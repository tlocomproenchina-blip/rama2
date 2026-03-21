import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/components/api/ApiQueueManager';
import { ROLE_PRESETS } from '@/lib/rolePermissions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, History, Loader2 } from 'lucide-react';
import PageHero from '@/components/common/PageHero';
import PerformanceMetricCard from '@/components/employee-performance/PerformanceMetricCard';
import EmployeePerformanceChart from '@/components/employee-performance/EmployeePerformanceChart';
import EmployeePerformanceLeaderboard from '@/components/employee-performance/EmployeePerformanceLeaderboard';
import EmployeePerformanceAlertsPanel from '@/components/employee-performance/EmployeePerformanceAlertsPanel';
import EmployeePerformanceTable from '@/components/employee-performance/EmployeePerformanceTable';
import EmployeePerformanceDetail from '@/components/employee-performance/EmployeePerformanceDetail';

function getTodayInCaracas() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export default function AdminEmployeePerformance({ user }) {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getTodayInCaracas());
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedEmail, setSelectedEmail] = useState('');

  useEffect(() => {
    let active = true;
    const loadMetrics = async () => {
      setLoading(true);
      const [rows, alertRows] = await Promise.all([
        base44.entities.EmployeePerformanceMetric.filter({ metric_date: selectedDate }, '-total_active_time_ms', 300),
        base44.entities.EmployeePerformanceAlert.filter({ metric_date: selectedDate }, '-updated_date', 100),
      ]);
      if (active) {
        setMetrics(rows || []);
        setAlerts(alertRows || []);
        setLoading(false);
      }
    };
    loadMetrics();
    return () => { active = false; };
  }, [selectedDate]);

  const filteredMetrics = useMemo(() => {
    const term = String(search || '').toLowerCase();
    return (metrics || []).filter((item) => {
      const matchesRole = roleFilter === 'all' || item.employee_role === roleFilter;
      const haystack = [item.employee_name, item.employee_email, item.employee_role].map((value) => String(value || '').toLowerCase()).join(' ');
      return matchesRole && (!term || haystack.includes(term));
    });
  }, [metrics, roleFilter, search]);

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
    const averageEfficiency = filteredMetrics.length ? filteredMetrics.reduce((sum, item) => sum + Number(item.active_efficiency_pct || 0), 0) / filteredMetrics.length : 0;
    const reviewCount = filteredMetrics.filter((item) => Number(item.active_efficiency_pct || 0) < 50).length;
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

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHero
        icon={BarChart3}
        badge="Rendimiento y hábitos del equipo"
        title="Dashboard de rendimiento de empleados"
        description="Analiza tiempo activo, eficiencia, sesiones, actividad por módulo y señales de seguimiento por empleado."
        actions={
          <div className="flex flex-wrap gap-3">
            <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-[190px]" />
            <Link to="/AdminEmployeeAudit"><Button variant="outline"><History className="h-4 w-4" /> Ver auditoría</Button></Link>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <PerformanceMetricCard title="Empleados activos" value={summary.totalEmployees} subtitle="Con métricas para la fecha seleccionada" accent="bg-blue-100 text-blue-700" />
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
    </div>
  );
}