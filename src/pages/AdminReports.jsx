import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  TrendingUp, 
  Users, 
  Package, 
  DollarSign, 
  AlertCircle,
  Loader2 
} from 'lucide-react';
import Pagination from "@/components/common/Pagination";

export default function AdminReports({ user }) {
  const [loading, setLoading] = useState(true);
  const [pendingPage, setPendingPage] = useState(0);
  const pendingPageSize = 50;
  const [topClients, setTopClients] = useState([]);
  const [revenueByMonth, setRevenueByMonth] = useState([]);
  const [packagesByStatus, setPackagesByStatus] = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);

  useEffect(() => {
    loadReportsData();
  }, []);

  const loadReportsData = async () => {
    try {
      const [allPackages, allConsolidations, allInvoices] = await Promise.all([
        base44.entities.Package.list(),
        base44.entities.Consolidation.list(),
        base44.entities.Invoice.list()
      ]);

      // 1. Clientes con más envíos
      const clientShipments = {};
      allPackages.forEach(pkg => {
        if (pkg.client_email) {
          if (!clientShipments[pkg.client_email]) {
            clientShipments[pkg.client_email] = { 
              email: pkg.client_email, 
              packages: 0, 
              consolidations: 0 
            };
          }
          clientShipments[pkg.client_email].packages++;
        }
      });

      allConsolidations.forEach(cons => {
        if (cons.client_email && clientShipments[cons.client_email]) {
          clientShipments[cons.client_email].consolidations++;
        }
      });

      // Construir lista usando email como nombre (evitar User.list())
      const clientsWithNames = Object.values(clientShipments).map(client => ({
        ...client,
        name: client.email
      }));

      const sortedClients = clientsWithNames.sort((a, b) => b.packages - a.packages).slice(0, 10);
      setTopClients(sortedClients);

      // 2. Ingresos por mes
      const revenueMap = {};
      allInvoices.forEach(invoice => {
        if (invoice.status === 'pagada' && invoice.payment_date) {
          const date = new Date(invoice.payment_date);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          if (!revenueMap[monthKey]) {
            revenueMap[monthKey] = { month: monthKey, revenue: 0, invoices: 0 };
          }
          revenueMap[monthKey].revenue += invoice.total;
          revenueMap[monthKey].invoices++;
        }
      });

      const revenueData = Object.values(revenueMap)
        .sort((a, b) => a.month.localeCompare(b.month))
        .slice(-12)
        .map(item => ({
          ...item,
          monthLabel: new Date(item.month + '-01').toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })
        }));
      setRevenueByMonth(revenueData);

      // 3. Paquetes por estado
      const statusMap = {};
      allPackages.forEach(pkg => {
        const status = pkg.status || 'sin_estado';
        if (!statusMap[status]) {
          statusMap[status] = { status, count: 0 };
        }
        statusMap[status].count++;
      });

      const statusLabels = {
        pre_alerta: 'Pre-alerta',
        recibido: 'Recibido',
        consolidado: 'Consolidado',
        en_transito: 'En Tránsito',
        disponible: 'Disponible',
        entregado: 'Entregado'
      };

      const statusData = Object.values(statusMap).map(item => ({
        ...item,
        label: statusLabels[item.status] || item.status
      }));
      setPackagesByStatus(statusData);

      // 4. Clientes con pagos pendientes
      const pendingInvoices = allInvoices.filter(inv => 
        inv.status === 'pendiente' || inv.status === 'vencida'
      );

      const pendingMap = {};
      pendingInvoices.forEach(invoice => {
        if (!pendingMap[invoice.client_email]) {
          pendingMap[invoice.client_email] = {
            email: invoice.client_email,
            name: invoice.client_email,
            invoices: [],
            total: 0
          };
        }
        pendingMap[invoice.client_email].invoices.push(invoice);
        pendingMap[invoice.client_email].total += invoice.total;
      });

      const pendingClients = Object.values(pendingMap).sort((a, b) => b.total - a.total);
      setPendingPayments(pendingClients);

      setLoading(false);
    } catch (error) {
      console.error('Error loading reports:', error);
      setLoading(false);
    }
  };

  const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white/20 rounded-xl">
            <TrendingUp className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Reportes</h1>
            <p className="text-indigo-100">Análisis y métricas del negocio</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="clients" className="space-y-6">
        <TabsList className="w-full overflow-x-auto whitespace-nowrap">
          <TabsTrigger value="clients">Top Clientes</TabsTrigger>
          <TabsTrigger value="revenue">Ingresos</TabsTrigger>
          <TabsTrigger value="packages">Paquetes</TabsTrigger>
          <TabsTrigger value="pending">Pagos Pendientes</TabsTrigger>
        </TabsList>

        {/* 1. Clientes con más envíos */}
        <TabsContent value="clients" className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Top 10 Clientes por Envíos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={topClients}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="packages" fill="#3b82f6" name="Paquetes" />
                  <Bar dataKey="consolidations" fill="#8b5cf6" name="Consolidaciones" />
                </BarChart>
              </ResponsiveContainer>

              <div className="mt-6 space-y-2">
                {topClients.map((client, index) => (
                  <div key={client.email} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{client.name}</p>
                        <p className="text-sm text-slate-500">{client.email}</p>
                      </div>
                    </div>
                    <div className="flex gap-4 text-sm">
                      <Badge variant="outline" className="bg-blue-50 text-blue-700">
                        {client.packages} paquetes
                      </Badge>
                      <Badge variant="outline" className="bg-purple-50 text-purple-700">
                        {client.consolidations} consolidaciones
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2. Ingresos por mes */}
        <TabsContent value="revenue" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-0 shadow-md">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Ingresos Totales</p>
                    <p className="text-2xl font-bold text-slate-800">
                      ${revenueByMonth.reduce((sum, item) => sum + item.revenue, 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="p-3 bg-emerald-100 rounded-xl">
                    <DollarSign className="h-6 w-6 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Facturas Pagadas</p>
                    <p className="text-2xl font-bold text-slate-800">
                      {revenueByMonth.reduce((sum, item) => sum + item.invoices, 0)}
                    </p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-xl">
                    <TrendingUp className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Promedio Mensual</p>
                    <p className="text-2xl font-bold text-slate-800">
                      ${revenueByMonth.length > 0 
                        ? (revenueByMonth.reduce((sum, item) => sum + item.revenue, 0) / revenueByMonth.length).toFixed(2)
                        : '0.00'}
                    </p>
                  </div>
                  <div className="p-3 bg-purple-100 rounded-xl">
                    <DollarSign className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-600" />
                Ingresos por Mes (Últimos 12 meses)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={revenueByMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="monthLabel" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value) => `$${value.toFixed(2)}`}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    name="Ingresos"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. Paquetes por estado */}
        <TabsContent value="packages" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-blue-600" />
                  Distribución por Estado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={packagesByStatus}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ label, percent }) => `${label}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {packagesByStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-blue-600" />
                  Cantidad por Estado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {packagesByStatus
                    .sort((a, b) => b.count - a.count)
                    .map((status, index) => (
                      <div key={status.status} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-4 h-4 rounded-full" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="font-medium text-slate-800">{status.label}</span>
                        </div>
                        <Badge variant="outline" className="text-lg font-semibold">
                          {status.count}
                        </Badge>
                      </div>
                    ))}
                  <div className="pt-3 border-t border-slate-200">
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <span className="font-bold text-slate-800">Total de Paquetes</span>
                      <Badge className="bg-blue-600 text-white text-lg font-bold">
                        {packagesByStatus.reduce((sum, s) => sum + s.count, 0)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 4. Pagos pendientes */}
        <TabsContent value="pending" className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                Clientes con Pagos Pendientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingPayments.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <AlertCircle className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                  <p>No hay pagos pendientes</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingPayments
                  .slice(pendingPage * pendingPageSize, (pendingPage + 1) * pendingPageSize)
                  .map((client) => (
                    <div key={client.email} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-slate-800">{client.name}</p>
                          <p className="text-sm text-slate-500">{client.email}</p>
                        </div>
                        <Badge className="bg-amber-100 text-amber-800 text-lg font-bold">
                          ${client.total.toFixed(2)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className="bg-red-50 text-red-700">
                          {client.invoices.length} factura{client.invoices.length > 1 ? 's' : ''} pendiente{client.invoices.length > 1 ? 's' : ''}
                        </Badge>
                      </div>
                      <div className="mt-3 space-y-2">
                        {client.invoices.map(invoice => (
                          <div key={invoice.id} className="flex items-center justify-between text-xs text-slate-600 bg-white p-2 rounded">
                            <span className="font-mono">{invoice.invoice_number}</span>
                            <span>${invoice.total.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="pt-4 border-t border-slate-200">
                    <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg">
                      <div>
                        <p className="text-sm text-slate-600">Total Pendiente de Cobro</p>
                        <p className="text-sm text-slate-500 mt-1">
                          {pendingPayments.reduce((sum, c) => sum + c.invoices.length, 0)} facturas pendientes
                        </p>
                      </div>
                      <p className="text-2xl font-bold text-amber-700">
                        ${pendingPayments.reduce((sum, c) => sum + c.total, 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <Pagination 
                page={pendingPage} 
                onPrev={() => setPendingPage(p => Math.max(p - 1, 0))} 
                onNext={() => setPendingPage(p => ((pendingPage + 1) * pendingPageSize < pendingPayments.length ? p + 1 : p))} 
                hasNext={(pendingPage + 1) * pendingPageSize < pendingPayments.length}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}