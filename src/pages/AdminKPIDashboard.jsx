import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/components/api/ApiQueueManager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Package, CheckCircle2, DollarSign, TrendingUp } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { startOfWeek, endOfWeek, addWeeks, format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";

export default function AdminKPIDashboard({ user }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [receivedPkgs, setReceivedPkgs] = useState([]);
  const [deliveredPkgs, setDeliveredPkgs] = useState([]);
  const [clients, setClients] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [rec, del, us] = await Promise.allSettled([
          base44.entities.Package.filter({ status: "recibido" }),
          base44.entities.Package.filter({ status: "entregado" }),
          base44.entities.User.filter({ role: "user" }),
        ]);
        setReceivedPkgs(rec.status === "fulfilled" ? rec.value : []);
        setDeliveredPkgs(del.status === "fulfilled" ? del.value : []);
        setClients(us.status === "fulfilled" ? us.value : []);
      } catch (e) {
        setError("No se pudieron cargar los datos");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Rango del mes actual
  const monthRange = useMemo(() => {
    const now = new Date();
    return { from: startOfMonth(now), to: endOfMonth(now) };
  }, []);

  // KPI: Paquetes recibidos este mes (usar received_date) y entregados (aprox. por updated_date)
  const { receivedThisMonth, deliveredThisMonth, monthlyFOB } = useMemo(() => {
    const inMonthReceived = receivedPkgs.filter((p) => {
      if (!p?.received_date) return false;
      const d = parseISO(p.received_date);
      return isWithinInterval(d, monthRange);
    });

    const inMonthDelivered = deliveredPkgs.filter((p) => {
      // No tenemos delivered_date; aproximamos con updated_date
      const d = p?.updated_date ? parseISO(p.updated_date) : null;
      return d ? isWithinInterval(d, monthRange) : false;
    });

    const fobSum = inMonthReceived.reduce((sum, p) => sum + (Number(p.fob_value) || 0), 0);

    return {
      receivedThisMonth: inMonthReceived.length,
      deliveredThisMonth: inMonthDelivered.length,
      monthlyFOB: fobSum,
    };
  }, [receivedPkgs, deliveredPkgs, monthRange]);

  // Serie semanal de nuevos clientes (últimas 12 semanas)
  const weeklySeries = useMemo(() => {
    const weeks = [];
    const today = new Date();
    const start = startOfWeek(addWeeks(today, -11), { weekStartsOn: 1 }); // hace 11 semanas + la actual

    for (let i = 0; i < 12; i++) {
      const ws = addWeeks(start, i);
      const we = endOfWeek(ws, { weekStartsOn: 1 });
      weeks.push({
        key: `${format(ws, "yyyy-MM-dd")}`,
        label: `${format(ws, "dd/MM")}–${format(we, "dd/MM")}`,
        start: ws,
        end: we,
        value: 0,
      });
    }

    clients.forEach((c) => {
      const d = c?.created_date ? parseISO(c.created_date) : null;
      if (!d) return;
      const idx = weeks.findIndex((w) => isWithinInterval(d, { start: w.start, end: w.end }));
      if (idx >= 0) weeks[idx].value += 1;
    });

    return weeks.map((w) => ({ week: w.label, clientes: w.value }));
  }, [clients]);

  if (user?.role !== "admin") {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="border-0 shadow-md">
          <CardContent className="p-6 text-center text-slate-600">
            Solo administradores pueden ver este dashboard.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-slate-800">Dashboard de KPIs</h1>
        <p className="text-slate-500">Visión general de desempeño (mes actual)</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-500">Paquetes recibidos (mes)</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between p-6 pt-0">
            <div className="text-4xl font-bold text-slate-800">{receivedThisMonth}</div>
            <div className="p-3 rounded-xl bg-blue-100">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-500">Paquetes entregados (mes)</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between p-6 pt-0">
            <div className="text-4xl font-bold text-slate-800">{deliveredThisMonth}</div>
            <div className="p-3 rounded-xl bg-emerald-100">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-500">FOB estimado (mes)</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between p-6 pt-0">
            <div>
              <div className="text-4xl font-bold text-slate-800">${monthlyFOB.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="text-xs text-slate-500 mt-1">Suma del valor FOB de paquetes recibidos</div>
            </div>
            <div className="p-3 rounded-xl bg-amber-100">
              <DollarSign className="h-6 w-6 text-amber-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly new clients chart */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-5 w-5" /> Crecimiento de clientes nuevos (semanal)
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklySeries} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorClients" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} angle={0} height={36} interval={0} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={40} />
                <Tooltip cursor={{ stroke: "#94a3b8", strokeWidth: 1 }} />
                <Area type="monotone" dataKey="clientes" stroke="#2563eb" fill="url(#colorClients)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="text-sm text-rose-600">{error}</div>
      )}
    </div>
  );
}