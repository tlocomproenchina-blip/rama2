import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { format, subDays, subMonths, subYears, parseISO } from "date-fns";
import es from "date-fns/locale/es";
import { DollarSign, FileText, Wallet, PieChart as PieChartIcon, CalendarRange } from "lucide-react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import DateRangeTabs from "@/components/dashboard/DateRangeTabs";
import StatCard from "@/components/dashboard/StatCard";
import RevenueTrendChart from "@/components/dashboard/RevenueTrendChart";
import APStatusPie from "@/components/dashboard/APStatusPie";

function inRange(dateStr, start, end) {
  if (!dateStr) return false;
  const d = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
  return d >= start && d <= end;
}

function toUSD(n) {
  const v = Number(n || 0);
  return v.toLocaleString('es-ES', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

export default function BusinessDashboard() {
  const [range, setRange] = useState('month'); // week | month | year
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [aps, setAps] = useState([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const [inv, ap] = await Promise.all([
          base44.entities.Invoice.list('-created_date', 800),
          base44.entities.AccountsPayable.list('-created_date', 800),
        ]);
        if (mounted) {
          setInvoices(inv || []);
          setAps(ap || []);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const { startDate, endDate, label } = useMemo(() => {
    const end = new Date();
    let start;
    if (range === 'week') start = subDays(end, 6);
    else if (range === 'month') start = subMonths(end, 1);
    else start = subYears(end, 1);
    return { startDate: start, endDate: end, label: `${format(start, 'dd MMM', { locale: es })} – ${format(end, 'dd MMM', { locale: es })}` };
  }, [range]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => inRange(inv.invoice_date || inv.created_date, startDate, endDate));
  }, [invoices, startDate, endDate]);

  const paymentsInRange = useMemo(() => {
    // Sum from payment_history entries in range; fallback to full total if payment_date in range
    let sum = 0;
    for (const inv of invoices) {
      const ph = Array.isArray(inv.payment_history) ? inv.payment_history : [];
      const inHist = ph.filter((p) => inRange(p.date, startDate, endDate));
      if (inHist.length > 0) {
        sum += inHist.reduce((s, p) => s + Number(p.amount_paid || 0), 0);
      } else if (inRange(inv.payment_date, startDate, endDate) && (inv.status === 'pagada' || inv.status === 'paid')) {
        sum += Number(inv.total || 0);
      }
    }
    return sum;
  }, [invoices, startDate, endDate]);

  const totalInvoiced = useMemo(() => {
    return filteredInvoices.reduce((s, inv) => s + Number(inv.total || 0), 0);
  }, [filteredInvoices]);

  const outstanding = useMemo(() => {
    let sum = 0;
    for (const inv of filteredInvoices) {
      const paid = (Array.isArray(inv.payment_history) ? inv.payment_history : []).reduce((s, p) => s + Number(p.amount_paid || 0), 0);
      const remaining = Math.max(Number(inv.total || 0) - paid, 0);
      // If status is pagada, remaining should be 0
      sum += (inv.status === 'pagada' ? 0 : remaining);
    }
    return sum;
  }, [filteredInvoices]);

  const trendData = useMemo(() => {
    // Build daily buckets
    const map = new Map();
    const dayKey = (d) => format(d, 'yyyy-MM-dd');
    // Initialize days within range
    for (let d = new Date(startDate); d <= endDate; d = new Date(d.getTime() + 86400000)) {
      map.set(dayKey(d), { date: format(d, 'dd/MM'), invoiced: 0, paid: 0 });
    }
    for (const inv of filteredInvoices) {
      const d = typeof inv.invoice_date === 'string' ? parseISO(inv.invoice_date) : (inv.invoice_date ? new Date(inv.invoice_date) : new Date(inv.created_date));
      const key = dayKey(d);
      if (map.has(key)) {
        const row = map.get(key);
        row.invoiced += Number(inv.total || 0);
      }
    }
    for (const inv of invoices) {
      const ph = Array.isArray(inv.payment_history) ? inv.payment_history : [];
      for (const p of ph) {
        const pd = typeof p.date === 'string' ? parseISO(p.date) : new Date(p.date);
        if (pd >= startDate && pd <= endDate) {
          const key = dayKey(pd);
          if (map.has(key)) {
            const row = map.get(key);
            row.paid += Number(p.amount_paid || 0);
          }
        }
      }
      if (inRange(inv.payment_date, startDate, endDate) && (inv.status === 'pagada' || inv.status === 'paid')) {
        const pd = typeof inv.payment_date === 'string' ? parseISO(inv.payment_date) : new Date(inv.payment_date);
        const key = dayKey(pd);
        if (map.has(key)) {
          const row = map.get(key);
          row.paid += Number(inv.total || 0);
        }
      }
    }
    return Array.from(map.values());
  }, [filteredInvoices, invoices, startDate, endDate]);

  const apPieData = useMemo(() => {
    const inRangeAps = aps.filter((a) => inRange(a.created_date, startDate, endDate));
    const groups = inRangeAps.reduce((acc, a) => {
      const key = a.status || 'otros';
      const amount = Number(a.balance_due ?? (a.original_amount_due || 0) - (a.amount_paid || 0) || 0);
      acc[key] = (acc[key] || 0) + Math.max(amount, 0);
      return acc;
    }, {});
    return Object.entries(groups).map(([name, value]) => ({ name, value }));
  }, [aps, startDate, endDate]);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Cargando métricas...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Dashboard de Negocio</h1>
          <p className="text-slate-500">Rango: {label}</p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangeTabs value={range} onChange={setRange} />
          <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="gap-2">
            <CalendarRange className="h-4 w-4" /> Actualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total Facturado" value={toUSD(totalInvoiced)} subtitle="Facturas emitidas en el rango" Icon={FileText} colorClass="text-blue-600" />
        <StatCard title="Pagos Recibidos" value={toUSD(paymentsInRange)} subtitle="Pagos registrados en el rango" Icon={DollarSign} colorClass="text-emerald-600" />
        <StatCard title="Saldo Pendiente" value={toUSD(outstanding)} subtitle="De facturas del rango aún por pagar" Icon={Wallet} colorClass="text-amber-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RevenueTrendChart data={trendData} />
        </div>
        <div>
          <APStatusPie data={apPieData} />
        </div>
      </div>

      <Card className="bg-white/80 border">
        <CardContent className="p-4 text-sm text-slate-600">
          <div className="flex flex-wrap gap-4">
            <div>Facturas consideradas: <strong>{filteredInvoices.length}</strong></div>
            <div>AP consideradas: <strong>{aps.filter(a => inRange(a.created_date, startDate, endDate)).length}</strong></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}