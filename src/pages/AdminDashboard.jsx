import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Package, 
  Layers, 
  Users, 
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Truck,
  Clock,
  ArrowRight,
  TrendingUp,
  Loader2
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';

export default function AdminDashboard({ user }) {
  const [stats, setStats] = useState({
    totalPackages: 0,
    preAlertas: 0,
    recibidos: 0,
    consolidaciones: 0,
    pendientesPago: 0,
    clientes: 0,
    totalIngresos: 0
  });
  const [recentPackages, setRecentPackages] = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    const [packages, consolidations, users] = await Promise.all([
      base44.entities.Package.list('-created_date'),
      base44.entities.Consolidation.list('-created_date'),
      base44.entities.User.filter({ role: 'user' })
    ]);

    const pendingPays = consolidations.filter(c => c.status === 'pago_pendiente_validacion');
    const totalRevenue = consolidations
      .filter(c => c.payment_validated)
      .reduce((sum, c) => sum + (c.total_cost || 0), 0);

    setStats({
      totalPackages: packages.length,
      preAlertas: packages.filter(p => p.status === 'pre_alerta').length,
      recibidos: packages.filter(p => p.status === 'recibido').length,
      consolidaciones: consolidations.length,
      pendientesPago: pendingPays.length,
      clientes: users.length,
      totalIngresos: totalRevenue
    });

    setRecentPackages(packages.slice(0, 5));
    setPendingPayments(pendingPays.slice(0, 3));
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Panel de Administración</h1>
        <p className="text-slate-500">Bienvenido, {user?.full_name || user?.email}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Paquetes</p>
                <p className="text-3xl font-bold text-slate-800">{stats.totalPackages}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Pre-alertas</p>
                <p className="text-3xl font-bold text-slate-800">{stats.preAlertas}</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-xl">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-purple-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Por Recibir</p>
                <p className="text-3xl font-bold text-slate-800">{stats.recibidos}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-xl">
                <Layers className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Clientes</p>
                <p className="text-3xl font-bold text-slate-800">{stats.clientes}</p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-xl">
                <Users className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Card */}
      <Card className="border-0 shadow-lg bg-gradient-to-r from-emerald-600 to-emerald-700 text-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-100">Ingresos Totales</p>
              <p className="text-4xl font-bold mt-1">${stats.totalIngresos.toFixed(2)}</p>
              <p className="text-emerald-200 text-sm mt-2 flex items-center gap-1">
                <TrendingUp className="h-4 w-4" />
                Pagos validados
              </p>
            </div>
            <div className="p-4 bg-white/20 rounded-2xl">
              <DollarSign className="h-10 w-10" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Payments */}
        {stats.pendientesPago > 0 && (
          <Card className="border-0 shadow-lg border-l-4 border-l-yellow-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-600" />
                Pagos Pendientes de Validación
                <span className="ml-auto bg-yellow-100 text-yellow-800 text-sm px-2 py-0.5 rounded-full">
                  {stats.pendientesPago}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingPayments.map((con) => (
                  <div key={con.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="font-medium text-slate-800">{con.consolidation_tracking}</p>
                      <p className="text-sm text-slate-500">${con.total_cost?.toFixed(2)}</p>
                    </div>
                    <StatusBadge status={con.status} size="sm" />
                  </div>
                ))}
              </div>
              <Link to={createPageUrl('AdminPayments')}>
                <Button variant="outline" className="w-full mt-4">
                  Ver Todos <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Recent Packages */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              Paquetes Recientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentPackages.map((pkg) => (
                <div key={pkg.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-800 font-mono">{pkg.tracking_number}</p>
                    <p className="text-sm text-slate-500">{pkg.shipping_mark}</p>
                  </div>
                  <StatusBadge status={pkg.status} size="sm" />
                </div>
              ))}
            </div>
            <Link to={createPageUrl('AdminPackages')}>
              <Button variant="outline" className="w-full mt-4">
                Ver Todos <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Link to={createPageUrl('AdminPackages')}>
          <Card className="border-0 shadow-md hover:shadow-lg transition-all cursor-pointer group h-full">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-4 bg-blue-100 rounded-xl group-hover:bg-blue-200 transition-colors">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Gestionar Paquetes</h3>
                <p className="text-slate-500 text-sm">Recepción y seguimiento</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to={createPageUrl('AdminConsolidate')}>
          <Card className="border-0 shadow-md hover:shadow-lg transition-all cursor-pointer group h-full">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-4 bg-purple-100 rounded-xl group-hover:bg-purple-200 transition-colors">
                <Layers className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Consolidar Cargas</h3>
                <p className="text-slate-500 text-sm">Agrupar paquetes</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to={createPageUrl('AdminClients')}>
          <Card className="border-0 shadow-md hover:shadow-lg transition-all cursor-pointer group h-full">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-4 bg-emerald-100 rounded-xl group-hover:bg-emerald-200 transition-colors">
                <Users className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Clientes</h3>
                <p className="text-slate-500 text-sm">Gestión de usuarios</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}