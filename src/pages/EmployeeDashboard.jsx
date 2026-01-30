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
  AlertTriangle,
  Truck,
  Clock,
  ArrowRight,
  Loader2,
  MapPin
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';

export default function EmployeeDashboard({ user }) {
  const [stats, setStats] = useState({
    totalPackages: 0,
    preAlertas: 0,
    recibidos: 0,
    enTransito: 0,
    disponibles: 0,
    consolidaciones: 0,
    pendientesPago: 0
  });
  const [recentPackages, setRecentPackages] = useState([]);
  const [pendingConsolidations, setPendingConsolidations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [packages, consolidations] = await Promise.all([
        base44.entities.Package.list('-created_date'),
        base44.entities.Consolidation.list('-created_date')
      ]);

      const pendingPays = consolidations.filter(c => 
        c.status === 'pago_pendiente_validacion' || c.status === 'pendiente_pago'
      );

      setStats({
        totalPackages: packages.length,
        preAlertas: packages.filter(p => p.status === 'pre_alerta').length,
        recibidos: packages.filter(p => p.status === 'recibido').length,
        enTransito: packages.filter(p => p.status === 'en_transito').length,
        disponibles: packages.filter(p => p.status === 'disponible').length,
        consolidaciones: consolidations.length,
        pendientesPago: pendingPays.length
      });

      setRecentPackages(packages.slice(0, 10));
      setPendingConsolidations(pendingPays.slice(0, 5));
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
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
        <h1 className="text-2xl font-bold text-slate-800">Panel de Empleado</h1>
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

        <Card className="border-0 shadow-md bg-gradient-to-br from-indigo-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">En Tránsito</p>
                <p className="text-3xl font-bold text-slate-800">{stats.enTransito}</p>
              </div>
              <div className="p-3 bg-indigo-100 rounded-xl">
                <Truck className="h-6 w-6 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-purple-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Recibidos</p>
                <p className="text-3xl font-bold text-slate-800">{stats.recibidos}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-xl">
                <Layers className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-teal-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Disponibles</p>
                <p className="text-3xl font-bold text-slate-800">{stats.disponibles}</p>
              </div>
              <div className="p-3 bg-teal-100 rounded-xl">
                <MapPin className="h-6 w-6 text-teal-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-purple-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Consolidaciones</p>
                <p className="text-3xl font-bold text-slate-800">{stats.consolidaciones}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-xl">
                <Layers className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-yellow-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Pendientes Pago</p>
                <p className="text-3xl font-bold text-slate-800">{stats.pendientesPago}</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-xl">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
              {recentPackages.slice(0, 5).map((pkg) => (
                <div key={pkg.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-800 font-mono text-sm">{pkg.tracking_number}</p>
                    <p className="text-xs text-slate-500">{pkg.shipping_mark}</p>
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

        {/* Pending Consolidations */}
        {stats.pendientesPago > 0 && (
          <Card className="border-0 shadow-lg border-l-4 border-l-yellow-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-600" />
                Consolidaciones Pendientes
                <span className="ml-auto bg-yellow-100 text-yellow-800 text-sm px-2 py-0.5 rounded-full">
                  {stats.pendientesPago}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingConsolidations.map((con) => (
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
                <h3 className="font-semibold text-slate-800">Ver Clientes</h3>
                <p className="text-slate-500 text-sm">Gestión de clientes</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}