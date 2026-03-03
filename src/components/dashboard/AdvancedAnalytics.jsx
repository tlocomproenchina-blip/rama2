import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileBarChart2 } from "lucide-react";
import { format } from "date-fns";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts";

function groupByMonth(items, getDate, reducer) {
  const map = new Map();
  items.forEach((it) => {
    const d = getDate(it);
    if (!d) return;
    const key = format(new Date(d), "yyyy-MM");
    const prev = map.get(key) || reducer.initial();
    map.set(key, reducer.acc(prev, it));
  });
  // sort by key
  return Array.from(map.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, agg]) => ({ month, ...reducer.out(agg) }));
}

const reducers = {
  count: {
    initial: () => ({ n: 0 }),
    acc: (prev) => ({ n: prev.n + 1 }),
    out: (agg) => ({ value: agg.n })
  },
  sum: (field) => ({
    initial: () => ({ s: 0 }),
    acc: (prev, it) => ({ s: prev.s + (Number(it?.[field]) || 0) }),
    out: (agg) => ({ value: Number(agg.s.toFixed(2)) })
  }),
  avgDays: (startField, endField) => ({
    initial: () => ({ total: 0, n: 0 }),
    acc: (prev, it) => {
      const s = it?.[startField] ? new Date(it[startField]) : null;
      const e = it?.[endField] ? new Date(it[endField]) : null;
      if (!s || !e) return prev;
      const days = (e - s) / (1000 * 60 * 60 * 24);
      return { total: prev.total + days, n: prev.n + 1 };
    },
    out: (agg) => ({ value: agg.n ? Number((agg.total / agg.n).toFixed(1)) : 0 })
  })
};

export default function AdvancedAnalytics({ userEmail }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [consolidations, setConsolidations] = useState([]);
  const [tickets, setTickets] = useState([]);

  const [serviceType, setServiceType] = useState("all"); // all | aereo | maritimo
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        setLoading(true);
        setError("");
        const [cons, tix] = await Promise.all([
          base44.entities.Consolidation.filter({ client_email: userEmail }),
          base44.entities.SupportTicket.filter({ client_email: userEmail })
        ]);
        if (!isMounted) return;
        setConsolidations(cons || []);
        setTickets(tix || []);
      } catch (e) {
        if (!isMounted) return;
        setError(e?.message || "Error cargando analítica");
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    if (userEmail) load();
    return () => {
      isMounted = false;
    };
  }, [userEmail]);

  // Filtering
  const filteredCons = useMemo(() => {
    return (consolidations || []).filter((c) => {
      if (serviceType !== "all" && c?.shipping_type !== serviceType) return false;
      const d = c?.shipping_date ? new Date(c.shipping_date) : null;
      if (dateFrom && (!d || d < new Date(dateFrom))) return false;
      if (dateTo && (!d || d > new Date(dateTo + "T23:59:59"))) return false;
      return true;
    });
  }, [consolidations, serviceType, dateFrom, dateTo]);

  const filteredTickets = useMemo(() => {
    return (tickets || []).filter((t) => {
      const d = t?.created_date ? new Date(t.created_date) : null;
      if (dateFrom && (!d || d < new Date(dateFrom))) return false;
      if (dateTo && (!d || d > new Date(dateTo + "T23:59:59"))) return false;
      return true;
    });
  }, [tickets, dateFrom, dateTo]);

  // Time series data
  const volumeData = useMemo(() => {
    return groupByMonth(filteredCons, (c) => c.shipping_date, reducers.count);
  }, [filteredCons]);

  const costData = useMemo(() => {
    return groupByMonth(filteredCons, (c) => c.shipping_date, reducers.sum("total_cost"));
  }, [filteredCons]);

  // Average delivery time - using estimated_delivery as proxy if actual delivered date is not stored
  const avgDeliveryData = useMemo(() => {
    return groupByMonth(filteredCons, (c) => c.shipping_date, reducers.avgDays("shipping_date", "estimated_delivery"));
  }, [filteredCons]);

  // Tickets summary
  const openCount = filteredTickets.filter((t) => ["abierto", "en_proceso"].includes((t.status || "").toLowerCase())).length;
  const closedCount = filteredTickets.filter((t) => ["resuelto", "cerrado"].includes((t.status || "").toLowerCase())).length;

  const ticketsData = useMemo(() => {
    // group by month of created_date; split by open/closed based on current status
    const map = new Map();
    filteredTickets.forEach((t) => {
      const key = format(new Date(t.created_date), "yyyy-MM");
      const rec = map.get(key) || { month: key, abiertos: 0, cerrados: 0 };
      if (["abierto", "en_proceso"].includes((t.status || "").toLowerCase())) rec.abiertos += 1;
      else if (["resuelto", "cerrado"].includes((t.status || "").toLowerCase())) rec.cerrados += 1;
      map.set(key, rec);
    });
    return Array.from(map.values()).sort((a, b) => (a.month < b.month ? -1 : 1));
  }, [filteredTickets]);

  const handleExport = () => {
    // Merge months from all series
    const months = new Set([
      ...volumeData.map((d) => d.month),
      ...costData.map((d) => d.month),
      ...avgDeliveryData.map((d) => d.month),
      ...ticketsData.map((d) => d.month)
    ]);
    const rows = [
      [
        "mes",
        "envios_cantidad",
        "costo_total",
        "eta_promedio_dias",
        "tickets_abiertos",
        "tickets_cerrados"
      ]
    ];
    const byMonth = (arr) => Object.fromEntries(arr.map((d) => [d.month, d.value ?? 0]));
    const volBy = byMonth(volumeData);
    const costBy = byMonth(costData);
    const etaBy = byMonth(avgDeliveryData);
    const tixBy = Object.fromEntries(ticketsData.map((d) => [d.month, d]));

    Array.from(months).sort().forEach((m) => {
      const t = tixBy[m] || { abiertos: 0, cerrados: 0 };
      rows.push([
        m,
        volBy[m] || 0,
        costBy[m] || 0,
        etaBy[m] || 0,
        t.abiertos || 0,
        t.cerrados || 0
      ]);
    });

    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reporte_avanzado.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardHeader className="p-4">
          <CardTitle className="text-base">Analítica Avanzada</CardTitle>
        </CardHeader>
        <CardContent className="p-6 text-center text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
          Cargando métricas...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-0 shadow-lg">
        <CardHeader className="p-4">
          <CardTitle className="text-base">Analítica Avanzada</CardTitle>
        </CardHeader>
        <CardContent className="p-6 text-rose-600 text-sm">{error}</CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="p-4 md:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <CardTitle className="text-base md:text-lg font-semibold text-slate-800">Analítica Avanzada</CardTitle>
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={serviceType} onValueChange={setServiceType}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Servicio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="aereo">Aéreo</SelectItem>
              <SelectItem value="maritimo">Marítimo</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" />
          <span className="text-slate-400">—</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" />
          <Button onClick={handleExport} variant="outline" className="gap-2">
            <FileBarChart2 className="h-4 w-4" /> Reporte avanzado
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border p-3">
            <div className="text-sm font-medium text-slate-700 mb-2">Volumen de envíos</div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={volumeData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="value" name="Envíos" stroke="#2563eb" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl border p-3">
            <div className="text-sm font-medium text-slate-700 mb-2">Costos totales ($)</div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={costData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="value" name="Costo" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl border p-3">
            <div className="text-sm font-medium text-slate-700 mb-2">Tiempo promedio de entrega (días)</div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={avgDeliveryData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="value" name="ETA promedio" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-slate-700">Reclamos: abiertos vs cerrados</div>
            <div className="text-xs text-slate-500">Abiertos: {openCount} · Cerrados: {closedCount}</div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ticketsData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="abiertos" name="Abiertos" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="cerrados" name="Cerrados" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}