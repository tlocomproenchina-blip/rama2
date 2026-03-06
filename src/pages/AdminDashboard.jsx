import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Package, Truck, DollarSign, Users, AlertCircle, CheckCircle2, Clock, TrendingUp, Eye, Bell, UserCheck, UserX } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import StatusBadge from '@/components/StatusBadge';
import ApiSystemPanel from '@/components/api/ApiSystemPanel';
import KeyStat from '@/components/dashboard/KeyStat';
import PieChartCard from '@/components/dashboard/PieChartCard';
import RecentActivity from '@/components/dashboard/RecentActivity';
import DashboardCustomizer from '@/components/dashboard/DashboardCustomizer';

export default function AdminDashboard({ user }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    packages: [],
    consolidations: [],
    users: [],
    invoices: [],
    notifications: []
  });

  // Paginación (cargar bajo demanda)
  const [packagesLimit, setPackagesLimit] = useState(10);
  const [consolidationsLimit, setConsolidationsLimit] = useState(10);
  const [invoicesLimit, setInvoicesLimit] = useState(10);
  const [hasMorePackages, setHasMorePackages] = useState(false);
  const [hasMoreConsolidations, setHasMoreConsolidations] = useState(false);
  const [hasMoreInvoices, setHasMoreInvoices] = useState(false);
  const [range, setRange] = useState('7d');
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [appConfig, setAppConfig] = useState(null);

  const [invFilter, setInvFilter] = useState('pendiente');
  const [consFilter, setConsFilter] = useState('todas');
  const [notifFilter, setNotifFilter] = useState('todas');
  const [mainTab, setMainTab] = useState('resumen');

  useEffect(() => {
    if (mainTab === 'resumen') {
      loadData();
    }
  }, [mainTab, packagesLimit, consolidationsLimit, invoicesLimit]);

  const loadData = async () => {
    try {
      // Cargar solo lo necesario para la pestaña Resumen y respetar los límites
      const [packages, consolidations, users, invoices, cfg] = await Promise.all([
        base44.entities.Package.list('-created_date', packagesLimit),
        base44.entities.Consolidation.list('-created_date', consolidationsLimit),
        base44.entities.User.filter({ role: 'user' }),
        base44.entities.Invoice.list('-created_date', invoicesLimit),
        base44.entities.AppConfig.filter({ config_key: 'main' })
      ]);

      setHasMorePackages(packages.length === packagesLimit);
      setHasMoreConsolidations(consolidations.length === consolidationsLimit);
      setHasMoreInvoices(invoices.length === invoicesLimit);
      
      setData({ packages, consolidations, users, invoices });
      if (Array.isArray(cfg) && cfg.length > 0) setAppConfig(cfg[0]);

      // Cargar notificaciones del admin (solo si estamos en resumen)
      if (user?.email) {
        try {
          const notifications = await base44.entities.Notification.filter({ user_email: user.email }, '-created_date', 20);
          setData(prev => ({ ...prev, notifications }));
        } catch {}
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
    setLoading(false);
  };

  const filterByRange = (arr, r) => {
    if (!Array.isArray(arr)) return [];
    const now = new Date();
    const start = new Date();
    if (r === 'today') { start.setHours(0,0,0,0); }
    else if (r === '7d') { start.setTime(now.getTime() - 7*24*60*60*1000); }
    else if (r === '30d') { start.setTime(now.getTime() - 30*24*60*60*1000); }
    else { start.setTime(0); }
    return arr.filter(it => new Date(it.created_date) >= start);
  };

  const pkgsR = React.useMemo(() => filterByRange(data.packages, range), [data.packages, range]);
  const consR = React.useMemo(() => filterByRange(data.consolidations, range), [data.consolidations, range]);

  const clientsActive = React.useMemo(() => data.users.filter(u => u.is_active !== false).length, [data.users]);
  const clientsInactive = React.useMemo(() => data.users.filter(u => u.is_active === false).length, [data.users]);

  const rangeStats = React.useMemo(() => ({
    packagesReceived: pkgsR.filter(p => p.status === 'recibido').length,
    packagesInTransit: pkgsR.filter(p => p.status === 'en_transito').length,
    shipmentsPie: [
      { name: 'En tránsito', value: consR.filter(c => c.status === 'en_transito').length },
      { name: 'Disponible', value: consR.filter(c => c.status === 'disponible').length },
      { name: 'Entregado', value: consR.filter(c => c.status === 'entregado').length },
      { name: 'Pago validado', value: consR.filter(c => c.payment_validated).length }
    ]
  }), [pkgsR, consR]);

  const rangeLabel = range === 'today' ? 'Hoy' : range === '7d' ? '7 días' : range === '30d' ? '30 días' : 'Todo el tiempo';

  const recentActivity = React.useMemo(() => {
    const items = [];
    pkgsR.slice(0, 100).forEach(p => items.push({
      type: 'package',
      title: `Paquete ${p.tracking_number}`,
      description: p.client_email,
      date: p.created_date
    }));
    consR.slice(0, 100).forEach(c => items.push({
      type: 'consolidation',
      title: `Consolidación ${c.consolidation_tracking || ''}`.trim(),
      description: c.status,
      date: c.created_date
    }));
    return items.sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
  }, [pkgsR, consR]);

  const stats = useMemo(() => {
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
    
    return {
      // Paquetes
      totalPackages: data.packages.length,
      preAlertas: data.packages.filter(p => p.status === 'pre_alerta').length,
      received: data.packages.filter(p => p.status === 'recibido').length,
      inTransit: data.packages.filter(p => p.status === 'en_transito').length,
      
      // Consolidaciones
      totalConsolidations: data.consolidations.length,
      pendingPayment: data.consolidations.filter(c => c.status === 'en_transito' && !c.payment_validated).length,
      pendingValidation: data.consolidations.filter(c => c.payment_proof_url && !c.payment_validated).length,
      available: data.consolidations.filter(c => c.status === 'disponible').length,
      
      // Ingresos
      totalRevenue: data.consolidations
        .filter(c => c.payment_validated)
        .reduce((sum, c) => sum + (c.total_cost || 0), 0),
      pendingRevenue: data.consolidations
        .filter(c => !c.payment_validated)
        .reduce((sum, c) => sum + (c.total_cost || 0), 0),
      monthRevenue: data.consolidations
        .filter(c => c.payment_validated && new Date(c.payment_validation_date) >= lastMonth)
        .reduce((sum, c) => sum + (c.total_cost || 0), 0),
      
      // Clientes
      totalClients: data.users.length,
      activeClients: new Set(data.packages.map(p => p.client_email)).size,
      
      // Facturas
      unpaidInvoices: data.invoices.filter(i => i.status === 'pendiente').length,
      overdueInvoices: data.invoices.filter(i => 
        i.status === 'pendiente' && new Date(i.due_date) < today
      ).length
    };
  }, [data]);

  const recentPackages = useMemo(() => data.packages, [data.packages]);

  const invoicesByFilter = useMemo(() => {
    let list = data.invoices;
    if (invFilter === 'pendiente') {
      list = list.filter(i => i.status === 'pendiente');
    } else if (invFilter === 'vencida') {
      const today = new Date();
      list = list.filter(i => i.status === 'pendiente' && new Date(i.due_date) < today);
    }
    return list;
  }, [data.invoices, invFilter]);

  const recentConsolidations = useMemo(() => {
    let list = data.consolidations;
    if (consFilter !== 'todas') {
      list = list.filter(c => c.status === consFilter);
    }
    return list;
  }, [data.consolidations, consFilter]);

  const notificationsSummary = useMemo(() => {
    let list = data.notifications || [];
    if (notifFilter === 'no_leidas') list = list.filter(n => !n.read);
    return list.slice(0, 5);
  }, [data.notifications, notifFilter]);

  const urgentActions = useMemo(() => {
    const actions = [];
    
    if (stats.pendingValidation > 0) {
      actions.push({
        title: 'Pagos por validar',
        count: stats.pendingValidation,
        icon: AlertCircle,
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        link: createPageUrl('AdminPayments')
      });
    }
    
    if (stats.overdueInvoices > 0) {
      actions.push({
        title: 'Facturas vencidas',
        count: stats.overdueInvoices,
        icon: DollarSign,
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        link: createPageUrl('AdminInvoices')
      });
    }
    
    if (stats.preAlertas > 10) {
      actions.push({
        title: 'Pre-alertas pendientes',
        count: stats.preAlertas,
        icon: Clock,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        link: createPageUrl('AdminPackages')
      });
    }
    
    return actions;
  }, [stats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Panel de Control</h1>
          <p className="text-slate-500">{mainTab === 'api' ? 'Estado del sistema y cola de API' : 'Resumen de operaciones'}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Tabs value={mainTab} onValueChange={setMainTab}>
            <TabsList>
              <TabsTrigger value="resumen">Resumen</TabsTrigger>
              <TabsTrigger value="api">API</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2">
            <Button onClick={loadData} variant="outline" size="sm">Actualizar</Button>
            <Button onClick={() => setShowCustomizer(true)} size="sm" className="bg-slate-800 hover:bg-slate-900 text-white">Personalizar</Button>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Button variant={range === 'today' ? 'default' : 'outline'} size="sm" onClick={() => setRange('today')}>Hoy</Button>
            <Button variant={range === '7d' ? 'default' : 'outline'} size="sm" onClick={() => setRange('7d')}>7 días</Button>
            <Button variant={range === '30d' ? 'default' : 'outline'} size="sm" onClick={() => setRange('30d')}>30 días</Button>
            <Button variant={range === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setRange('all')}>Todo el tiempo</Button>
          </div>
        </div>
      </div>

      {mainTab === 'api' ? (
        <ApiSystemPanel />
      ) : (
        <>
      {/* Acciones Urgentes */}
      {urgentActions.length > 0 && (
        <Card className="border-l-4 border-l-red-500 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              Acciones Urgentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {urgentActions.map((action, idx) => (
                <Link key={idx} to={action.link}>
                  <div className={`flex items-center justify-between p-4 rounded-lg ${action.bgColor} hover:opacity-80 transition-opacity cursor-pointer`}>
                    <div className="flex items-center gap-3">
                      <action.icon className={`h-6 w-6 ${action.color}`} />
                      <div>
                        <p className="font-semibold text-slate-800">{action.title}</p>
                        <p className="text-sm text-slate-600">{action.count} pendiente{action.count !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <Badge className={`${action.color} bg-white`}>
                      {action.count}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Métricas Clave (personalizables) */}
      {((appConfig?.admin_dashboard_prefs || {}).showClients !== false || (appConfig?.admin_dashboard_prefs || {}).showPackages !== false) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {(appConfig?.admin_dashboard_prefs?.showClients ?? true) && (
            <KeyStat title="Clientes activos" value={clientsActive} icon={UserCheck} accent="bg-emerald-100 text-emerald-700" />
          )}
          {(appConfig?.admin_dashboard_prefs?.showClients ?? true) && (
            <KeyStat title="Clientes inactivos" value={clientsInactive} icon={UserX} accent="bg-rose-100 text-rose-700" />
          )}
          {(appConfig?.admin_dashboard_prefs?.showPackages ?? true) && (
            <KeyStat title="Paquetes en tránsito" value={rangeStats.packagesInTransit} icon={Truck} accent="bg-indigo-100 text-indigo-700" />
          )}
          {(appConfig?.admin_dashboard_prefs?.showPackages ?? true) && (
            <KeyStat title="Paquetes recibidos" value={rangeStats.packagesReceived} icon={Package} accent="bg-blue-100 text-blue-700" />
          )}
        </div>
      )}

      {/* Estado general de envíos + Actividad */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(appConfig?.admin_dashboard_prefs?.showStatusPie ?? true) && (
          <PieChartCard title={`Estado general de envíos (${rangeLabel})`} data={rangeStats.shipmentsPie} />
        )}
        {(appConfig?.admin_dashboard_prefs?.showRecent ?? true) && (
          <RecentActivity items={recentActivity} />
        )}
      </div>

      {/* Métricas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Paquetes</p>
                <p className="text-3xl font-bold text-slate-800">{stats.totalPackages}</p>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    {stats.preAlertas} pre-alertas
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {stats.received} recibidos
                  </Badge>
                </div>
              </div>
              <div className="p-4 bg-blue-100 rounded-xl">
                <Package className="h-8 w-8 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Consolidaciones</p>
                <p className="text-3xl font-bold text-slate-800">{stats.totalConsolidations}</p>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    {stats.available} disponibles
                  </Badge>
                  <Badge variant="outline" className="text-xs text-red-600">
                    {stats.pendingValidation} validar
                  </Badge>
                </div>
              </div>
              <div className="p-4 bg-purple-100 rounded-xl">
                <Truck className="h-8 w-8 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Ingresos del Mes</p>
                <p className="text-3xl font-bold text-green-600">${stats.monthRevenue.toFixed(2)}</p>
                <p className="text-xs text-slate-500 mt-2">
                  Total: ${stats.totalRevenue.toFixed(2)}
                </p>
              </div>
              <div className="p-4 bg-green-100 rounded-xl">
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Clientes</p>
                <p className="text-3xl font-bold text-slate-800">{stats.totalClients}</p>
                <p className="text-xs text-slate-500 mt-2">
                  {stats.activeClients} activos
                </p>
              </div>
              <div className="p-4 bg-indigo-100 rounded-xl">
                <Users className="h-8 w-8 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pagos Pendientes */}
        </>
      )}
      {mainTab !== 'api' && (
        <>
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Resumen de Pagos
            </CardTitle>
            <Link to={createPageUrl('AdminPayments')}>
              <Button variant="outline" size="sm">
                Ver todos
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Pendientes de Pago</p>
                  <p className="text-2xl font-bold text-yellow-700">{stats.pendingPayment}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-600" />
              </div>
              <p className="text-xs text-slate-600 mt-2">
                ${stats.pendingRevenue.toFixed(2)} por cobrar
              </p>
            </div>

            <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Por Validar</p>
                  <p className="text-2xl font-bold text-orange-700">{stats.pendingValidation}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-orange-600" />
              </div>
            </div>

            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Validados</p>
                  <p className="text-2xl font-bold text-green-700">
                    {data.consolidations.filter(c => c.payment_validated).length}
                  </p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Paquetes Recientes */}
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Paquetes Recientes
            </CardTitle>
            <Link to={createPageUrl('AdminPackages')}>
              <Button variant="outline" size="sm">
                <Eye className="h-4 w-4 mr-2" />
                Ver todos
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentPackages.length === 0 ? (
            <p className="text-center text-slate-500 py-8">No hay paquetes</p>
          ) : (
            <>
              <div className="space-y-3">
                {recentPackages.map((pkg) => (
                  <div key={pkg.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <p className="font-medium text-slate-800">{pkg.tracking_number}</p>
                        <StatusBadge status={pkg.status} size="sm" />
                      </div>
                      <div className="flex items-center gap-4 mt-1">
                        <p className="text-sm text-slate-600">{pkg.client_email}</p>
                        <Badge variant="outline" className="text-xs">
                          {pkg.shipping_type === 'aereo' ? '✈️ Aéreo' : '🚢 Marítimo'}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">
                      {new Date(pkg.created_date).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
              {hasMorePackages && (
                <div className="mt-4 text-center">
                  <Button variant="outline" size="sm" onClick={() => setPackagesLimit((v) => v + 10)}>Cargar más</Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Facturas Pendientes */}
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Facturas
            </CardTitle>
            <Tabs value={invFilter} onValueChange={setInvFilter}>
              <TabsList>
                <TabsTrigger value="pendiente">Pendientes</TabsTrigger>
                <TabsTrigger value="vencida">Vencidas</TabsTrigger>
                <TabsTrigger value="todas">Todas</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {invoicesByFilter.length === 0 ? (
            <p className="text-sm text-slate-500">No hay facturas</p>
          ) : (
            <>
              <div className="space-y-3">
                {invoicesByFilter.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 truncate">{inv.invoice_number} • {inv.client_email}</p>
                      <p className="text-xs text-slate-500">Fecha: {new Date(inv.invoice_date).toLocaleDateString()} • Vence: {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">${(inv.total || 0).toFixed(2)}</Badge>
                      <Link to={createPageUrl('AdminInvoices')}>
                        <Button size="sm" variant="outline">Ver</Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
              {hasMoreInvoices && (
                <div className="mt-4 text-center">
                  <Button variant="outline" size="sm" onClick={() => setInvoicesLimit((v) => v + 10)}>Cargar más</Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Consolidaciones Recientes */}
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Consolidaciones Recientes
            </CardTitle>
            <Tabs value={consFilter} onValueChange={setConsFilter}>
              <TabsList>
                <TabsTrigger value="todas">Todas</TabsTrigger>
                <TabsTrigger value="en_transito">En tránsito</TabsTrigger>
                <TabsTrigger value="disponible">Disponible</TabsTrigger>
                <TabsTrigger value="entregado">Entregado</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {recentConsolidations.length === 0 ? (
            <p className="text-sm text-slate-500">No hay consolidaciones</p>
          ) : (
            <>
              <div className="space-y-3">
                {recentConsolidations.map(cons => (
                  <div key={cons.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 truncate">{cons.consolidation_tracking || 'Sin tracking'} • {cons.client_email}</p>
                      <p className="text-xs text-slate-500">{new Date(cons.created_date).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">${(cons.total_cost || 0).toFixed(2)}</Badge>
                      <StatusBadge status={cons.status} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
              {hasMoreConsolidations && (
                <div className="mt-4 text-center">
                  <Button variant="outline" size="sm" onClick={() => setConsolidationsLimit((v) => v + 10)}>Cargar más</Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>


      {/* Links Rápidos */}
      <div className="grid md:grid-cols-3 gap-4">
        <Link to={createPageUrl('AdminPackages')}>
          <Card className="shadow-md hover:shadow-lg transition-shadow cursor-pointer bg-gradient-to-br from-blue-50 to-white">
            <CardContent className="p-6 text-center">
              <Package className="h-10 w-10 text-blue-600 mx-auto mb-3" />
              <p className="font-semibold text-slate-800">Gestionar Paquetes</p>
            </CardContent>
          </Card>
        </Link>

        <Link to={createPageUrl('AdminPayments')}>
          <Card className="shadow-md hover:shadow-lg transition-shadow cursor-pointer bg-gradient-to-br from-green-50 to-white">
            <CardContent className="p-6 text-center">
              <DollarSign className="h-10 w-10 text-green-600 mx-auto mb-3" />
              <p className="font-semibold text-slate-800">Validar Pagos</p>
            </CardContent>
          </Card>
        </Link>

        <Link to={createPageUrl('AdminClients')}>
          <Card className="shadow-md hover:shadow-lg transition-shadow cursor-pointer bg-gradient-to-br from-purple-50 to-white">
            <CardContent className="p-6 text-center">
              <Users className="h-10 w-10 text-purple-600 mx-auto mb-3" />
              <p className="font-semibold text-slate-800">Ver Clientes</p>
            </CardContent>
          </Card>
        </Link>
      </div>
        </>
      )}
      <DashboardCustomizer 
        open={showCustomizer} 
        onOpenChange={setShowCustomizer}
        prefs={appConfig?.admin_dashboard_prefs}
        onSave={async (p) => {
          try {
            if (appConfig?.id) {
              await base44.entities.AppConfig.update(appConfig.id, { admin_dashboard_prefs: p });
              setAppConfig(prev => ({ ...(prev || {}), admin_dashboard_prefs: p }));
            }
          } catch (e) {}
          setShowCustomizer(false);
        }}
      />
    </div>
  );
}