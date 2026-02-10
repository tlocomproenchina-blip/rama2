import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, Truck, DollarSign, Users, AlertCircle, CheckCircle2, Clock, TrendingUp, Eye } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import StatusBadge from '@/components/StatusBadge';

export default function AdminDashboard({ user }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    packages: [],
    consolidations: [],
    users: [],
    invoices: []
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [packages, consolidations, users, invoices] = await Promise.all([
        base44.entities.Package.list('-created_date', 100),
        base44.entities.Consolidation.list('-created_date', 100),
        base44.entities.User.filter({ role: 'user' }),
        base44.entities.Invoice.list('-created_date', 50)
      ]);
      
      setData({ packages, consolidations, users, invoices });
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
    setLoading(false);
  };

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

  const recentPackages = useMemo(() => 
    data.packages.slice(0, 5),
    [data.packages]
  );

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Panel de Control</h1>
          <p className="text-slate-500">Resumen de operaciones</p>
        </div>
        <Button onClick={loadData} variant="outline" size="sm">
          Actualizar
        </Button>
      </div>

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
    </div>
  );
}