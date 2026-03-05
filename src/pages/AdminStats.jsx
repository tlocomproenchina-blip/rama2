import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  BarChart as RBarChart, Bar, LineChart as RLineChart, Line, PieChart as RPieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Package, Timer, Users, Loader2 } from 'lucide-react';

export default function AdminStats({ user }) {
  const [loading, setLoading] = useState(true);
  const [packagesByMonth, setPackagesByMonth] = useState([]);
  const [deliveryAvgByMonth, setDeliveryAvgByMonth] = useState([]);
  const [clientsByState, setClientsByState] = useState([]);

  useEffect(() => { loadData(); }, []);

  const makeMonthKey = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  const makeMonthLabel = (key) => new Date(`${key}-01T00:00:00`).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });

  const lastNMonthKeys = (n) => {
    const now = new Date();
    const keys = [];
    for (let i = n-1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
      keys.push(makeMonthKey(d));
    }
    return keys;
  };

  const loadData = async () => {
    try {
      const [allPackages, allConsolidations, users, states] = await Promise.all([
        base44.entities.Package.list(),
        base44.entities.Consolidation.list(),
        base44.entities.User.filter({ role: 'user' }),
        base44.entities.StateConfig.list()
      ]);

      // 1) Volumen de paquetes recibidos por mes (últimos 12)
      const monthKeys = lastNMonthKeys(12);
      const pkgMap = Object.fromEntries(monthKeys.map(k => [k, 0]));
      allPackages.forEach((p) => {
        const dt = new Date(p.received_date || p.created_date);
        if (!isNaN(dt)) {
          const key = makeMonthKey(dt);
          if (pkgMap[key] !== undefined) pkgMap[key] += 1;
        }
      });
      const pkgSeries = monthKeys.map(k => ({ month: makeMonthLabel(k), key: k, count: pkgMap[k] }));
      setPackagesByMonth(pkgSeries);

      // 2) Tiempo promedio de entrega (consolidaciones entregadas): (updated_date - shipping_date) en días, por mes de entrega
      const delMap = {}; // key -> { sumDays, n }
      allConsolidations.forEach((c) => {
        if (c.status === 'entregado' && c.shipping_date) {
          const ship = new Date(c.shipping_date);
          const delivered = new Date(c.updated_date || c.shipping_date);
          if (!isNaN(ship) && !isNaN(delivered) && delivered > ship) {
            const days = (delivered - ship) / (1000*60*60*24);
            const k = makeMonthKey(delivered);
            if (!delMap[k]) delMap[k] = { sum: 0, n: 0 };
            delMap[k].sum += days;
            delMap[k].n += 1;
          }
        }
      });
      const delKeys = lastNMonthKeys(12);
      const delSeries = delKeys.map(k => ({ month: makeMonthLabel(k), key: k, avgDays: delMap[k] ? +(delMap[k].sum / delMap[k].n).toFixed(1) : 0 }));
      setDeliveryAvgByMonth(delSeries);

      // 3) Distribución de clientes por estado
      const stateNameByCode = Object.fromEntries((states||[]).map(s => [s.state_code, s.state_name]));
      const byState = {};
      users.forEach(u => {
        const codeLike = (u.state && !String(u.state).includes(' ')) ? u.state : null;
        const key = codeLike || (u.state || 'sin_estado');
        byState[key] = (byState[key] || 0) + 1;
      });
      const stateSeries = Object.entries(byState).map(([key, count]) => ({
        key,
        label: stateNameByCode[key] || key.replaceAll('_',' ').replace(/\b\w/g, m => m.toUpperCase()),
        count
      })).sort((a,b)=>b.count-a.count);
      setClientsByState(stateSeries);

      setLoading(false);
    } catch (e) {
      console.error('Error loading admin stats:', e);
      setLoading(false);
    }
  };

  const COLORS = ['#3b82f6','#10b981','#8b5cf6','#f59e0b','#ef4444','#06b6d4','#22c55e','#a855f7','#fb923c','#e11d48'];

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
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-5 text-white shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white/20 rounded-xl">
            <Package className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Estadísticas</h1>
            <p className="text-blue-50">Visión operativa: paquetes, tiempos y clientes</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="packages" className="space-y-6">
        <TabsList className="w-full overflow-x-auto whitespace-nowrap">
          <TabsTrigger value="packages">Paquetes por Mes</TabsTrigger>
          <TabsTrigger value="delivery">Tiempo Promedio de Entrega</TabsTrigger>
          <TabsTrigger value="clients">Clientes por Estado</TabsTrigger>
        </TabsList>

        {/* Paquetes por mes */}
        <TabsContent value="packages">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Volumen de paquetes recibidos (últimos 12 meses)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={380}>
                <RBarChart data={packagesByMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" name="Paquetes" fill="#3b82f6" radius={[6,6,0,0]} />
                </RBarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tiempo promedio de entrega */}
        <TabsContent value="delivery">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Timer className="h-5 w-5 text-emerald-600" />Tiempo promedio de entrega (días)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={380}>
                <RLineChart data={deliveryAvgByMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="avgDays" name="Días" stroke="#10b981" strokeWidth={3} dot={{ r: 3 }} />
                </RLineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Clientes por estado */}
        <TabsContent value="clients">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-blue-600" />Distribución de clientes por estado</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={360}>
                  <RPieChart>
                    <Pie data={clientsByState} cx="50%" cy="50%" outerRadius={120} dataKey="count" nameKey="label">
                      {clientsByState.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RPieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Top estados por cantidad de clientes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {clientsByState.slice(0, 12).map((s, idx) => (
                    <div key={s.key} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                        <span className="font-medium text-slate-800">{s.label}</span>
                      </div>
                      <Badge variant="outline" className="text-base">{s.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}