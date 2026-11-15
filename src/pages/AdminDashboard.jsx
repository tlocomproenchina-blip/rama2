import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/components/api/ApiQueueManager';
import { base44 as sdk } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PremiumLoader from '@/components/common/PremiumLoader';
import AdminDashboardMetricCard from '@/components/dashboard/AdminDashboardMetricCard';
import AdminDashboardSectionCard from '@/components/dashboard/AdminDashboardSectionCard';
import AdminDashboardQuickLink from '@/components/dashboard/AdminDashboardQuickLink';
import StatusBadge from '@/components/StatusBadge';
import { EXCLUDED_QUERY, withoutExcluded } from '@/lib/excludedAccounts';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  DollarSign,
  Package,
  RefreshCw,
  Ticket,
  TrendingUp,
  Truck,
  Users,
} from 'lucide-react';

export default function AdminDashboard({ user }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    packages: [],
    consolidations: [],
    supportTickets: [],
    counts: {},
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const nowIso = now.toISOString();
      const [
        packages, consolidations, supportTickets, usersRes,
        preAlerts, received, inTransit, availableConsolidations, pendingValidation, openTickets, overdueInvoices,
        totalAgg, monthAgg,
      ] = await Promise.all([
        base44.entities.Package.list('-created_date', 6),
        base44.entities.Consolidation.list('-created_date', 6),
        base44.entities.SupportTicket.list('-updated_date', 5),
        base44.functions.invoke('listAllUsers', { role: 'user', includeAdmins: false, limit: 5000 }).then(r => r?.data || {}),
        base44.entities.Package.count({ ...EXCLUDED_QUERY, status: 'pre_alerta' }),
        base44.entities.Package.count({ ...EXCLUDED_QUERY, status: 'recibido' }),
        base44.entities.Package.count({ ...EXCLUDED_QUERY, status: 'en_transito' }),
        base44.entities.Consolidation.count({ ...EXCLUDED_QUERY, status: 'disponible' }),
        base44.entities.Consolidation.count({ ...EXCLUDED_QUERY, payment_proof_url: { $exists: true, $ne: '' }, payment_validated: { $ne: true } }),
        base44.entities.SupportTicket.count({ ...EXCLUDED_QUERY, status: 'abierto' }),
        base44.entities.Invoice.count({ ...EXCLUDED_QUERY, status: 'pendiente', due_date: { $lt: nowIso } }),
        sdk.entities.Invoice.aggregate({ query: { ...EXCLUDED_QUERY, status: 'pagada' }, sum: ['total'] }),
        sdk.entities.Invoice.aggregate({ query: { ...EXCLUDED_QUERY, status: 'pagada', payment_date: { $gte: monthStart } }, sum: ['total'] }),
      ]);

      const allClients = usersRes.users || [];
      const clients = withoutExcluded(allClients, 'email');
      const inactiveClients = clients.filter((item) => item.is_active === false).length;
      const totalClients = Number(usersRes.total ?? allClients.length) - (allClients.length - clients.length);

      setData({
        packages, consolidations, supportTickets,
        counts: {
          activeClients: totalClients - inactiveClients,
          inactiveClients,
          preAlerts, received, inTransit, availableConsolidations,
          pendingValidation, openTickets, overdueInvoices,
        },
        totalRevenue: Number(totalAgg?.rows?.[0]?.sum_total || 0),
        monthRevenue: Number(monthAgg?.rows?.[0]?.sum_total || 0),
      });
    } catch (error) {
      console.error('Error loading admin dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.email]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const metrics = useMemo(() => {
    const {
      activeClients = 0, inactiveClients = 0, preAlerts = 0, received = 0, inTransit = 0,
      availableConsolidations = 0, pendingValidation = 0, openTickets = 0, overdueInvoices = 0,
    } = data.counts || {};
    const monthRevenue = data.monthRevenue || 0;
    const totalRevenue = data.totalRevenue || 0;

    return {
      activeClients,
      inactiveClients,
      preAlerts,
      received,
      inTransit,
      availableConsolidations,
      pendingValidation,
      openTickets,
      overdueInvoices,
      monthRevenue,
      totalRevenue,
    };
  }, [data]);

  const urgentItems = useMemo(() => {
    const items = [];
    if (metrics.pendingValidation > 0) {
      items.push({ title: 'Pagos por validar', count: metrics.pendingValidation, to: createPageUrl('AdminPayments'), tone: 'rose' });
    }
    if (metrics.overdueInvoices > 0) {
      items.push({ title: 'Facturas vencidas', count: metrics.overdueInvoices, to: createPageUrl('AdminInvoices'), tone: 'amber' });
    }
    if (metrics.openTickets > 0) {
      items.push({ title: 'Tickets abiertos', count: metrics.openTickets, to: `${createPageUrl('AdminSupportCRM')}?tab=tickets`, tone: 'violet' });
    }
    if (metrics.preAlerts > 0) {
      items.push({ title: 'Pre-alertas pendientes', count: metrics.preAlerts, to: createPageUrl('AdminPreAlerts'), tone: 'blue' });
    }
    return items;
  }, [metrics]);

  const recentPackages = useMemo(() => data.packages.slice(0, 6), [data.packages]);
  const recentConsolidations = useMemo(() => data.consolidations.slice(0, 6), [data.consolidations]);
  const recentTickets = useMemo(() => data.supportTickets.slice(0, 5), [data.supportTickets]);

  if (loading) {
    return <PremiumLoader title="Cargando dashboard" description="Estamos preparando el nuevo panel administrativo." />;
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[calc(var(--radius)+0.75rem)] border border-border/70 bg-gradient-to-br from-sky-50 via-white to-blue-100 text-foreground shadow-card">
        <div className="grid gap-6 p-6 md:p-8 lg:grid-cols-[1.4fr_0.9fr] lg:items-end">
          <div>
            <Badge className="border-primary/20 bg-card text-primary hover:bg-card">Dashboard administrativo</Badge>
            <h1 className="mt-4 text-3xl font-bold md:text-5xl">Centro operativo de TLEC Cargo</h1>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">
              Un panel nuevo desde cero para ver clientes, paquetes, consolidaciones, ingresos y tareas pendientes en un solo lugar.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={loadData}>
                <RefreshCw className="mr-2 h-4 w-4" /> Actualizar dashboard
              </Button>
              <Button asChild variant="outline">
                <Link to={createPageUrl('AdminPackages')}>
                  Ver operaciones <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl border border-border/70 bg-card/80 p-5 shadow-card">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Ingresos cobrados</p>
              <p className="mt-3 text-3xl font-bold">${metrics.totalRevenue.toFixed(2)}</p>
              <p className="mt-2 text-sm text-muted-foreground">Acumulado validado</p>
            </div>
            <div className="rounded-3xl border border-border/70 bg-card/80 p-5 shadow-card">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Ingresos del mes</p>
              <p className="mt-3 text-3xl font-bold">${metrics.monthRevenue.toFixed(2)}</p>
              <p className="mt-2 text-sm text-muted-foreground">Validaciones del mes actual</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminDashboardMetricCard title="Clientes activos" value={metrics.activeClients} subtitle="Usuarios habilitados para operar" icon={Users} tone="emerald" badge={`${metrics.inactiveClients} inactivos`} />
        <AdminDashboardMetricCard title="Paquetes recibidos" value={metrics.received} subtitle="Ingresados en almacén" icon={Package} tone="blue" badge={`${metrics.preAlerts} pre-alertas`} />
        <AdminDashboardMetricCard title="Carga en tránsito" value={metrics.inTransit} subtitle="Paquetes moviéndose actualmente" icon={Truck} tone="violet" badge={`${metrics.availableConsolidations} disponibles`} />
        <AdminDashboardMetricCard title="Pagos por validar" value={metrics.pendingValidation} subtitle="Comprobantes pendientes de revisión" icon={DollarSign} tone="amber" badge={`${metrics.overdueInvoices} facturas vencidas`} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <AdminDashboardSectionCard
          title="Atención inmediata"
          description="Accesos rápidos a lo más urgente del día."
          action={<Badge variant="outline">{urgentItems.length} alertas</Badge>}
        >
          {urgentItems.length === 0 ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              Todo está bajo control por ahora.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {urgentItems.map((item) => (
                <Link key={item.title} to={item.to} className="rounded-2xl border border-border/70 bg-slate-50 p-4 transition-colors hover:bg-slate-100">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">Requiere revisión del equipo.</p>
                    </div>
                    <Badge>{item.count}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </AdminDashboardSectionCard>

        <AdminDashboardSectionCard
          title="Resumen de soporte"
          description="Tickets recientes con el estado actual."
          action={<Button asChild variant="outline" size="sm"><Link to={`${createPageUrl('AdminSupportCRM')}?tab=tickets`}>Abrir soporte</Link></Button>}
        >
          <div className="space-y-3">
            {recentTickets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay tickets recientes.</p>
            ) : recentTickets.map((ticket) => (
              <div key={ticket.id} className="rounded-2xl border border-border/70 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{ticket.subject}</p>
                    <p className="mt-1 text-sm text-muted-foreground break-all">{ticket.client_email}</p>
                  </div>
                  <StatusBadge status={ticket.status} size="sm" />
                </div>
              </div>
            ))}
          </div>
        </AdminDashboardSectionCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <AdminDashboardSectionCard
          title="Paquetes recientes"
          description="Últimos movimientos registrados en el sistema."
          action={<Button asChild variant="outline" size="sm"><Link to={createPageUrl('AdminPackages')}>Ver paquetes</Link></Button>}
        >
          <div className="space-y-3">
            {recentPackages.map((pkg) => (
              <div key={pkg.id} className="rounded-2xl border border-border/70 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 break-all">{pkg.tracking_number}</p>
                    <p className="mt-1 text-sm text-muted-foreground break-all">{pkg.client_email}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{pkg.shipping_type === 'aereo' ? 'Aéreo' : 'Marítimo'}</Badge>
                    <StatusBadge status={pkg.status} size="sm" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </AdminDashboardSectionCard>

        <AdminDashboardSectionCard
          title="Consolidaciones recientes"
          description="Salidas y cargas con actividad más reciente."
          action={<Button asChild variant="outline" size="sm"><Link to={createPageUrl('ShipmentTracking')}>Ver consolidaciones</Link></Button>}
        >
          <div className="space-y-3">
            {recentConsolidations.map((item) => (
              <div key={item.id} className="rounded-2xl border border-border/70 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 break-all">{item.consolidation_tracking || 'Sin tracking'}</p>
                    <p className="mt-1 text-sm text-muted-foreground break-all">{item.client_email}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">${Number(item.total_cost || 0).toFixed(2)}</Badge>
                    <StatusBadge status={item.status} size="sm" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </AdminDashboardSectionCard>
      </section>

      <section>
        <AdminDashboardSectionCard title="Accesos rápidos" description="Navegación directa a las áreas clave del equipo.">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AdminDashboardQuickLink to={createPageUrl('AdminPackages')} title="Operaciones de paquetes" description="Revisa ingresos, estados y seguimientos." icon={Package} tone="blue" />
            <AdminDashboardQuickLink to={createPageUrl('AdminPayments')} title="Validación de pagos" description="Confirma comprobantes y pagos pendientes." icon={CheckCircle2} tone="emerald" />
            <AdminDashboardQuickLink to={createPageUrl('AdminClients')} title="Gestión de clientes" description="Administra usuarios, estados y datos." icon={Users} tone="violet" />
            <AdminDashboardQuickLink to={`${createPageUrl('AdminSupportCRM')}?tab=tickets`} title="Mesa de ayuda" description="Da seguimiento a tickets y solicitudes." icon={Ticket} tone="amber" />
          </div>
        </AdminDashboardSectionCard>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <AdminDashboardMetricCard title="Tickets abiertos" value={metrics.openTickets} subtitle="Casos pendientes de atención" icon={Ticket} tone="rose" />
        <AdminDashboardMetricCard title="Facturas vencidas" value={metrics.overdueInvoices} subtitle="Clientes con pagos atrasados" icon={Clock} tone="amber" />
        <AdminDashboardMetricCard title="Ingresos del mes" value={`$${metrics.monthRevenue.toFixed(2)}`} subtitle="Total validado en el mes actual" icon={TrendingUp} tone="slate" />
      </section>
    </div>
  );
}