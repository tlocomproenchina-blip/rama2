import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  DollarSign, 
  FileText,
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ArrowRight,
  Loader2,
  CreditCard
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';

export default function AccountingDashboard({ user }) {
  const [stats, setStats] = useState({
    totalInvoices: 0,
    pendingInvoices: 0,
    paidInvoices: 0,
    overdueInvoices: 0,
    totalRevenue: 0,
    pendingAmount: 0
  });
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [invoices, consolidations] = await Promise.all([
        base44.entities.Invoice.list('-created_date'),
        base44.entities.Consolidation.filter({ status: 'pago_validado' })
      ]);

      const pending = invoices.filter(i => i.status === 'pendiente');
      const paid = invoices.filter(i => i.status === 'pagada');
      const overdue = invoices.filter(i => i.status === 'vencida');

      const totalRev = invoices.reduce((sum, i) => sum + (i.total || 0), 0);
      const pendingAmt = pending.reduce((sum, i) => sum + (i.total || 0), 0);

      setStats({
        totalInvoices: invoices.length,
        pendingInvoices: pending.length,
        paidInvoices: paid.length,
        overdueInvoices: overdue.length,
        totalRevenue: totalRev,
        pendingAmount: pendingAmt
      });

      setRecentInvoices(invoices.slice(0, 8));
      setPendingPayments(consolidations.slice(0, 5));
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
        <h1 className="text-2xl font-bold text-slate-800">Panel de Contabilidad</h1>
        <p className="text-slate-500">Gestión financiera y validación de pagos</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Facturas</p>
                <p className="text-3xl font-bold text-slate-800">{stats.totalInvoices}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Ingresos Totales</p>
                <p className="text-3xl font-bold text-slate-800">${stats.totalRevenue.toFixed(0)}</p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-xl">
                <DollarSign className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Pendientes de Pago</p>
                <p className="text-3xl font-bold text-slate-800">${stats.pendingAmount.toFixed(0)}</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-xl">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-yellow-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Vencidas</p>
                <p className="text-3xl font-bold text-slate-800">{stats.overdueInvoices}</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-xl">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Pendientes</p>
                <p className="text-3xl font-bold text-slate-800">{stats.pendingInvoices}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-green-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Pagadas</p>
                <p className="text-3xl font-bold text-slate-800">{stats.paidInvoices}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-xl">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Invoices */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Facturas Recientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentInvoices.slice(0, 5).map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-800 font-mono text-sm">{invoice.invoice_number}</p>
                    <p className="text-xs text-slate-500">${invoice.total?.toFixed(2)}</p>
                  </div>
                  <StatusBadge status={invoice.status} size="sm" />
                </div>
              ))}
            </div>
            <Link to={createPageUrl('AdminInvoices')}>
              <Button variant="outline" className="w-full mt-4">
                Ver Todas <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Pending Validations */}
        {stats.overdueInvoices > 0 && (
          <Card className="border-0 shadow-lg border-l-4 border-l-red-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                Facturas Vencidas
                <span className="ml-auto bg-red-100 text-red-800 text-sm px-2 py-0.5 rounded-full">
                  {stats.overdueInvoices}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Link to={createPageUrl('AdminPaymentAlerts')}>
                <Button variant="outline" className="w-full">
                  Revisar Alertas <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Link to={createPageUrl('AdminPayments')}>
          <Card className="border-0 shadow-md hover:shadow-lg transition-all cursor-pointer group h-full">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-4 bg-green-100 rounded-xl group-hover:bg-green-200 transition-colors">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Validar Pagos</h3>
                <p className="text-slate-500 text-sm">Verificar comprobantes</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to={createPageUrl('AdminInvoices')}>
          <Card className="border-0 shadow-md hover:shadow-lg transition-all cursor-pointer group h-full">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-4 bg-blue-100 rounded-xl group-hover:bg-blue-200 transition-colors">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Gestionar Facturas</h3>
                <p className="text-slate-500 text-sm">Crear y validar</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to={createPageUrl('AdminReports')}>
          <Card className="border-0 shadow-md hover:shadow-lg transition-all cursor-pointer group h-full">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-4 bg-purple-100 rounded-xl group-hover:bg-purple-200 transition-colors">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Ver Reportes</h3>
                <p className="text-slate-500 text-sm">Análisis financiero</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}