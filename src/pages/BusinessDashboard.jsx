import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import MetricCard from "@/components/dashboard/MetricCard";
import DateRangeSelector from "@/components/dashboard/DateRangeSelector";
import InvoicesVsPayments from "@/components/dashboard/charts/InvoicesVsPayments";
import ApStatusChart from "@/components/dashboard/charts/ApStatusChart";
import { Loader2, FileText, DollarSign, Wallet } from "lucide-react";

function formatCurrency(n) {
  const v = Number(n || 0);
  return v.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function startOfRange(mode) {
  const now = new Date();
  if (mode === "week") {
    const d = new Date(now);
    d.setDate(now.getDate() - 6);
    d.setHours(0,0,0,0);
    return d;
  }
  if (mode === "year") {
    return new Date(now.getFullYear(), 0, 1);
  }
  // month default
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function daysBetween(start, end) {
  const ms = 24*60*60*1000;
  const arr = [];
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  while (d <= end) {
    arr.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return arr;
}

export default function BusinessDashboard({ user }) {
  const [range, setRange] = useState("month");
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [aps, setAps] = useState([]);

  const start = startOfRange(range);
  const end = new Date();

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const [inv, pay] = await Promise.all([
          base44.entities.Invoice.list('-created_date', 1000),
          base44.entities.AccountsPayable.list('-created_date', 1000),
        ]);
        if (!mounted) return;
        setInvoices(inv || []);
        setAps(pay || []);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [range]);

  const inRange = (dateStr, fallbackStr) => {
    const s = dateStr || fallbackStr;
    if (!s) return false;
    const d = new Date(s);
    return d >= start && d <= end;
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter((i) => inRange(i.invoice_date, i.created_date));
  }, [invoices, range]);

  const totalIssued = useMemo(() => {
    return filteredInvoices.reduce((sum, i) => sum + Number(i.total || 0), 0);
  }, [filteredInvoices]);

  const paymentsReceived = useMemo(() => {
    let sum = 0;
    for (const inv of filteredInvoices) {
      if (Array.isArray(inv.payment_history)) {
        for (const p of inv.payment_history) {
          if (inRange(p.date)) sum += Number(p.amount_paid || 0);
        }
      }
      if ((!inv.payment_history || inv.payment_history.length === 0) && inv.status === 'pagada' && inRange(inv.payment_date)) {
        sum += Number(inv.total || 0);
      }
    }
    return sum;
  }, [filteredInvoices]);

  const pendingBalance = Math.max(0, totalIssued - paymentsReceived);

  const byDay = useMemo(() => {
    const labels = daysBetween(start, end).map((d) => d.toISOString().slice(5,10));
    const map = Object.fromEntries(labels.map((l) => [l, { label: l, emitidas: 0, pagos: 0 }]));
    for (const inv of filteredInvoices) {
      const key = (inv.invoice_date || inv.created_date) ? new Date(inv.invoice_date || inv.created_date).toISOString().slice(5,10) : null;
      if (key && map[key]) map[key].emitidas += Number(inv.total || 0);
      if (Array.isArray(inv.payment_history)) {
        for (const p of inv.payment_history) {
          if (inRange(p.date)) {
            const k = new Date(p.date).toISOString().slice(5,10);
            if (map[k]) map[k].pagos += Number(p.amount_paid || 0);
          }
        }
      } else if (inv.status === 'pagada' && inRange(inv.payment_date)) {
        const k = new Date(inv.payment_date).toISOString().slice(5,10);
        if (map[k]) map[k].pagos += Number(inv.total || 0);
      }
    }
    return Object.values(map);
  }, [filteredInvoices, range]);

  const apSummary = useMemo(() => {
    const initial = { pendiente: { monto: 0, count: 0 }, parcial: { monto: 0, count: 0 }, pagado: { monto: 0, count: 0 }, vencido: { monto: 0, count: 0 }, disputa: { monto: 0, count: 0 } };
    for (const ap of aps) {
      if (!inRange(ap.created_date)) continue;
      const st = ap.status || 'pendiente';
      const key = initial[st] ? st : 'pendiente';
      const bal = Number(ap.balance_due ?? Math.max(Number(ap.original_amount_due || 0) - Number(ap.amount_paid || 0), 0));
      initial[key].monto += bal;
      initial[key].count += 1;
    }
    return initial;
  }, [aps, range]);

  if (user && user.role && user.role !== 'admin') {
    return (
      <div className="min-h-[50vh] grid place-items-center text-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Acceso restringido</h1>
          <p className="text-slate-600 mt-1">Este panel está disponible solo para administradores.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Dashboard de Negocio</h1>
          <p className="text-slate-500">Métricas clave con filtros por fecha</p>
        </div>
        <DateRangeSelector value={range} onChange={setRange} />
      </div>

      {loading ? (
        <div className="py-16 text-slate-500 flex items-center justify-center"><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Cargando...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <MetricCard title="Facturas Emitidas" value={formatCurrency(totalIssued)} icon={FileText} />
            <MetricCard title="Pagos Recibidos" value={formatCurrency(paymentsReceived)} icon={DollarSign} />
            <MetricCard title="Saldo Pendiente" value={formatCurrency(pendingBalance)} icon={Wallet} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <InvoicesVsPayments data={byDay} />
            </div>
            <div className="lg:col-span-1">
              <ApStatusChart data={apSummary} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}