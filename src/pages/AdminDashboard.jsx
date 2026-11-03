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
    users: [],
    invoices: [],
    supportTickets: [],
    notifications: [],
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const [packages, consolidations, users, invoices, supportTickets, notifications, totalAgg, monthAgg] = await Promise.all([
        base44.entities.Package.list('-created_date', 120),
        base44.entities.Consolidation.list('-created_date', 120),
        base44.functions.invoke('listAllUsers', { role: 'user', limit: 200 }).then(r => r?.data?.users || []),
        base44.entities.Invoice.list('-created_date', 120),
        base44.entities.SupportTicket.list('-updated_date', 80),
        user?.email ? base44.entities.Notification.filter({ user_email: user.email }, '-created_date', 20) : Promise.resolve([]),
        sdk.entities.Invoice.aggregate({ query: { status: 'pagada' }, sum: ['total'] }),
        sdk.entities.Invoice.aggregate({ query: { status: 'pagada', payment_date: { $gte: monthStart } }, sum: ['total'] }),
      ]);

      setData({
        packages, consolidations, users, invoices, supportTickets, notifications,
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
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const activeClients = data.users.filter((item) => item.is_active !== false).length;
    const inactiveClients = data.users.filter((item) => item.is_active === false).length;
    const preAlerts = data.packages.filter((item) => item.status === 'pre_alerta').length;
    const received = data.packages.filter((item) => item.status === 'recibido').length;
    const inTransit = data.packages.filter((item) => item.status === 'en_transito').length;
    const availableConsolidations = data.consolidations.filter((item) => item.status === 'disponible').length;
    const pendingValidation = data.consolidations.filter((item) => item.payment_proof_url && !item.payment_validated).length;
    const openTickets = data.supportTickets.filter((item) => item.status === 'abierto').length;
    const overdueInvoices = data.invoices.filter((item) => item.status === 'pendiente' && item.due_date && new Date(item.due_date) < today).length;
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
      items.push({ title: 'Tickets abiertos', count: metrics.openTickets, to: createPageUrl('AdminSupportTickets'), tone: 'violet' });
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
              <Link to={createPageUrl('AdminPackages')}>
                <Button variant="outline">
                  Ver operaciones <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
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
          action={<Link to={createPageUrl('AdminSupportTickets')}><Button variant="outline" size="sm">Abrir soporte</Button></Link>}
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
          action={<Link to={createPageUrl('AdminPackages')}><Button variant="outline" size="sm">Ver paquetes</Button></Link>}
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
          action={<Link to={createPageUrl('ShipmentTracking')}><Button variant="outline" size="sm">Ver consolidaciones</Button></Link>}
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
            <AdminDashboardQuickLink to={createPageUrl('AdminSupportTickets')} title="Mesa de ayuda" description="Da seguimiento a tickets y solicitudes." icon={Ticket} tone="amber" />
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