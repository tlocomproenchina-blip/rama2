import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import KpiCard from "../components/dashboard/KpiCard";
import FiltersBar from "../components/dashboard/FiltersBar";
import ShipmentsOverTime from "../components/dashboard/charts/ShipmentsOverTime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Package, DollarSign, Timer, AlertCircle, Truck, Wallet, TrendingUp } from "lucide-react";

function toDate(d) {
  if (!d) return null;
  try { return new Date(d); } catch { return null; }
}

function inRange(date, startDate, endDate) {
  if (!date) return false;
  const t = date.setHours(0,0,0,0);
  const s = startDate ? toDate(startDate).setHours(0,0,0,0) : null;
  const e = endDate ? toDate(endDate).setHours(0,0,0,0) : null;
  if (s && t < s) return false;
  if (e && t > e) return false;
  return true;
}

function groupByWeek(items, dateGetter) {
  const map = new Map();
  items.forEach((it) => {
    const d = dateGetter(it);
    if (!d) return;
    const dt = new Date(d);
    // ISO week label YYYY-WW
    const firstDay = new Date(dt.getFullYear(), 0, 1);
    const days = Math.floor((dt - firstDay) / 86400000);
    const week = Math.ceil((days + firstDay.getDay() + 1) / 7);
    const label = `${dt.getFullYear()}-W${String(week).padStart(2, '0')}`;
    map.set(label, (map.get(label) || 0) + 1);
  });
  return Array.from(map.entries()).sort((a,b) => a[0].localeCompare(b[0])).map(([label, count]) => ({ label, count }));
}

export default function AdvancedDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [consolidations, setConsolidations] = useState([]);
  const [packages, setPackages] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [providerPayments, setProviderPayments] = useState([]);
  const [pricingConfig, setPricingConfig] = useState(null);

  const [filters, setFilters] = useState({ startDate: "", endDate: "", serviceType: "all" });
  const [applied, setApplied] = useState(filters);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [cons, pkgs, tks, pays, pricing] = await Promise.all([
        base44.entities.Consolidation.list(),
        base44.entities.Package.list(),
        base44.entities.SupportTicket.list(),
        base44.entities.ProviderPayment.list(),
        base44.entities.PricingConfig.filter({ config_key: 'main' }),
      ]);
      setConsolidations(cons || []);
      setPackages(pkgs || []);
      setTickets(tks || []);
      setProviderPayments(pays || []);
      setPricingConfig((pricing && pricing[0]) || null);
    } catch (e) {
      setError(e?.message || 'Error al cargar datos');
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    const svc = applied.serviceType;

    const cons = (consolidations || []).filter(c => {
      const svcOk = svc === 'all' || c.shipping_type === svc;
      const d = toDate(c.shipping_date);
      const dateOk = !applied.startDate && !applied.endDate ? true : inRange(d, applied.startDate, applied.endDate);
      return svcOk && dateOk;
    });

    const pkgs = (packages || []).filter(p => {
      const svcOk = svc === 'all' || p.shipping_type === svc;
      const d = toDate(p.received_date);
      const dateOk = !applied.startDate && !applied.endDate ? true : inRange(d, applied.startDate, applied.endDate);
      return svcOk && dateOk;
    });

    const tks = (tickets || []).filter(t => {
      const d = toDate(t.created_date);
      const dateOk = !applied.startDate && !applied.endDate ? true : inRange(d, applied.startDate, applied.endDate);
      return dateOk;
    });

    const pays = (providerPayments || []).filter(p => {
      const d = toDate(p.payment_date);
      const dateOk = !applied.startDate && !applied.endDate ? true : inRange(d, applied.startDate, applied.endDate);
      return dateOk;
    });

    return { cons, pkgs, tks, pays };
  }, [consolidations, packages, tickets, providerPayments, applied]);

  const metrics = useMemo(() => {
    const { cons, pkgs, tks, pays } = filtered;

    const totalCBM = cons.reduce((sum, c) => sum + (Number(c.cbm) || 0), 0);
    const sumShipping = cons.reduce((sum, c) => sum + (Number(c.shipping_cost) || 0), 0);
    const sumInsurance = cons.reduce((sum, c) => sum + (Number(c.insurance_cost) || 0), 0);
    const totalRevenue = sumShipping + sumInsurance;

    // Promedio estimado (si existen ambas fechas)
    const withEta = cons.filter(c => c.shipping_date && c.estimated_delivery);
    const avgEtaDays = withEta.length > 0
      ? Math.round(withEta.reduce((sum, c) => {
          const s = toDate(c.shipping_date);
          const e = toDate(c.estimated_delivery);
          if (!s || !e) return sum;
          const days = (e - s) / 86400000;
          return sum + (isFinite(days) ? days : 0);
        }, 0) / withEta.length)
      : null;

    const openTickets = tks.filter(t => t.status === 'abierto' || t.status === 'en_proceso').length;
    const closedTickets = tks.filter(t => t.status === 'resuelto' || t.status === 'cerrado').length;

    const providerPaymentsTotal = (pays || []).reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0);
    const profitPct = Number(pricingConfig?.profit_percentage) || 10;
    const profit = sumShipping * (profitPct / 100) + sumInsurance;

    return {
      consolidationsCount: cons.length,
      packagesCount: pkgs.length,
      totalCBM,
      totalRevenue,
      providerPaymentsTotal,
      profit,
      avgEtaDays,
      openTickets,
      closedTickets,
    };
  }, [filtered, pricingConfig]);

  const chartData = useMemo(() => {
    const consBy = groupByWeek(filtered.cons, (c) => toDate(c.shipping_date));
    const pkgBy = groupByWeek(filtered.pkgs, (p) => toDate(p.received_date));
    const labels = Array.from(new Set([...consBy.map(d => d.label), ...pkgBy.map(d => d.label)])).sort();
    return labels.map(label => ({
      label,
      consolidations: consBy.find(d => d.label === label)?.count || 0,
      packages: pkgBy.find(d => d.label === label)?.count || 0,
    }));
  }, [filtered]);

  const handleFilterChange = (patch) => setFilters(prev => ({ ...prev, ...patch }));
  const applyFilters = () => setApplied(filters);

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-slate-600">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Cargando dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-rose-600">
        <AlertCircle className="h-5 w-5 mr-2" /> {error}
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-slate-900">Panel de Control Avanzado</h1>
      </div>

      <FiltersBar
        startDate={filters.startDate}
        endDate={filters.endDate}
        serviceType={filters.serviceType}
        onChange={handleFilterChange}
        onApply={applyFilters}
        loading={loading}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <KpiCard title="Consolidaciones" value={metrics.consolidationsCount} subtitle={applied.serviceType === 'all' ? 'Todos los servicios' : (applied.serviceType === 'aereo' ? 'Aéreo' : 'Marítimo')} icon={Truck} accent="indigo" />
        <KpiCard title="Paquetes" value={metrics.packagesCount} subtitle="Recibidos en período" icon={Package} accent="emerald" />
        <KpiCard title="CBM Total" value={metrics.totalCBM.toFixed(2)} subtitle="Volumen consolidado" icon={Package} accent="purple" />
        <KpiCard title="Ingresos Totales (USD)" value={metrics.totalRevenue.toFixed(2)} subtitle="Flete + Seguro" icon={DollarSign} accent="amber" />
        <KpiCard title="Pagos a Proveedores (USD)" value={metrics.providerPaymentsTotal.toFixed(2)} subtitle="Periodo seleccionado" icon={Wallet} accent="rose" />
        <KpiCard title="Beneficios (USD)" value={metrics.profit.toFixed(2)} subtitle="10% Flete + Seguros" icon={TrendingUp} accent="emerald" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <Card className="border-0 shadow-md md:col-span-2">
          <CardHeader>
            <CardTitle className="text-slate-800">Evolución de Envíos</CardTitle>
          </CardHeader>
          <CardContent>
            <ShipmentsOverTime data={chartData} />
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-slate-800">Tiempos y Reclamos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <KpiCard title="Tiempo prom. estimado" value={metrics.avgEtaDays !== null ? `${metrics.avgEtaDays} días` : 'N/D'} subtitle="Entre zarpe y fecha estimada" icon={Timer} accent="slate" />
            <div className="grid grid-cols-2 gap-3">
              <KpiCard title="Reclamos abiertos" value={metrics.openTickets} icon={AlertCircle} accent="rose" />
              <KpiCard title="Reclamos cerrados" value={metrics.closedTickets} icon={AlertCircle} accent="emerald" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-slate-800">Top consolidaciones recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2 pr-2">Tracking</th>
                  <th className="py-2 pr-2">Servicio</th>
                  <th className="py-2 pr-2">Fecha zarpe</th>
                  <th className="py-2 pr-2">CBM</th>
                  <th className="py-2 pr-2">Costo</th>
                  <th className="py-2 pr-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {(filtered.cons || []).slice(0, 10).map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-2 pr-2 font-mono text-slate-800">{c.consolidation_tracking || '-'}</td>
                    <td className="py-2 pr-2 capitalize">{c.shipping_type || '-'}</td>
                    <td className="py-2 pr-2">{c.shipping_date ? new Date(c.shipping_date).toLocaleDateString() : '-'}</td>
                    <td className="py-2 pr-2">{Number(c.cbm || 0).toFixed(2)}</td>
                    <td className="py-2 pr-2">${Number((c.shipping_cost || 0) + (c.insurance_cost || 0)).toFixed(2)}</td>
                    <td className="py-2 pr-2 capitalize">{c.status || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}