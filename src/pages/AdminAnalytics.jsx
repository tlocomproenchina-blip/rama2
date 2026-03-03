import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, DollarSign, Clock, RefreshCcw } from "lucide-react";
import DateServiceFilters from "@/components/analytics/DateServiceFilters.jsx";
import KpiCard from "@/components/analytics/KpiCard.jsx";
import VolumeChart from "@/components/analytics/VolumeChart.jsx";
import CostsChart from "@/components/analytics/CostsChart.jsx";
import TicketsSummary from "@/components/analytics/TicketsSummary.jsx";
import { format, parseISO, isAfter, isBefore } from "date-fns";

export default function AdminAnalytics({ user }) {
  const [loading, setLoading] = useState(true);
  const [consolidations, setConsolidations] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [filters, setFilters] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 90);
    return { startDate: format(start, 'yyyy-MM-dd'), endDate: format(end, 'yyyy-MM-dd'), service: 'all' };
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [cons, tks] = await Promise.all([
          base44.entities.Consolidation.filter({}, '-created_date', 1000),
          base44.entities.SupportTicket.filter({}, '-created_date', 1000)
        ]);
        setConsolidations(cons || []);
        setTickets(tks || []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const dateInRange = (dateStr) => {
    if (!dateStr) return false;
    const d = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
    const start = parseISO(filters.startDate);
    const end = parseISO(filters.endDate);
    return (isAfter(d, new Date(start.getTime() - 1)) && isBefore(d, new Date(end.getTime() + 24*60*60*1000)));
  };

  const filteredConsolidations = useMemo(() => {
    return (consolidations || []).filter(c => {
      const serviceOk = filters.service === 'all' || c.shipping_type === filters.service;
      const dateOk = c.shipping_date ? dateInRange(c.shipping_date) : dateInRange(c.created_date);
      return serviceOk && dateOk;
    });
  }, [consolidations, filters]);

  const filteredTickets = useMemo(() => {
    return (tickets || []).filter(t => dateInRange(t.created_date));
  }, [tickets, filters]);

  // KPIs
  const totalShipments = filteredConsolidations.length;
  const totalCbm = filteredConsolidations.reduce((sum, c) => sum + (Number(c.cbm) || 0), 0);
  const totalBillableKg = filteredConsolidations.reduce((sum, c) => sum + (Number(c.billable_weight) || 0), 0);
  const totalCost = filteredConsolidations.reduce((sum, c) => sum + (Number(c.total_cost) || 0), 0);

  const delivered = filteredConsolidations.filter(c => c.status === 'entregado' && c.shipping_date);
  const avgDeliveryDays = delivered.length > 0 ? (
    delivered.reduce((sum, c) => {
      const ship = parseISO(c.shipping_date);
      const deliveredAt = c.delivered_date ? parseISO(c.delivered_date) : (c.updated_date ? parseISO(c.updated_date) : null);
      if (!deliveredAt) return sum;
      const diffDays = (deliveredAt - ship) / (1000*60*60*24);
      return sum + Math.max(0, diffDays);
    }, 0) / delivered.length
  ) : 0;

  const openTickets = filteredTickets.filter(t => t.status === 'abierto' || t.status === 'en_proceso').length;
  const closedTickets = filteredTickets.filter(t => t.status === 'resuelto' || t.status === 'cerrado').length;

  const handleApplyFilters = (next) => setFilters(next);

  if (user && user.role !== 'admin') {
    return (
      <div className="p-6 text-center text-slate-600">Solo administradores pueden ver este panel.</div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 lg:space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Analytics Operativo</h1>
          <p className="text-slate-500 text-sm">Resumen visual de consolidaciones, costos y reclamos</p>
        </div>
        <Button variant="outline" size="sm" onClick={async () => {
          setLoading(true);
          try {
            const [cons, tks] = await Promise.all([
              base44.entities.Consolidation.filter({}, '-created_date', 1000),
              base44.entities.SupportTicket.filter({}, '-created_date', 1000)
            ]);
            setConsolidations(cons || []);
            setTickets(tks || []);
          } finally { setLoading(false); }
        }} className="gap-2"><RefreshCcw className="h-4 w-4"/>Actualizar</Button>
      </div>

      <Card className="border-0 shadow-sm rounded-2xl bg-white/70 backdrop-blur">
        <CardContent className="p-4">
          <DateServiceFilters value={filters} onApply={handleApplyFilters} />
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500"><Loader2 className="h-5 w-5 mr-2 animate-spin"/>Cargando métricas…</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <KpiCard icon={TrendingUp} label="Consolidaciones" value={totalShipments} suffix="" />
            <KpiCard icon={TrendingUp} label="Volumen (CBM)" value={totalCbm} suffix=" cbm" />
            <KpiCard icon={DollarSign} label="Costo Total" value={totalCost} prefix="$" />
            <KpiCard icon={Clock} label="Tiempo Promedio Entrega" value={Number(avgDeliveryDays.toFixed(1))} suffix=" días" />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
            <VolumeChart consolidations={filteredConsolidations} />
            <CostsChart consolidations={filteredConsolidations} />
          </div>

          {/* Tickets Summary */}
          <TicketsSummary openCount={openTickets} closedCount={closedTickets} />

          {/* Extra KPI for aereo */}
          {filters.service === 'aereo' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <KpiCard icon={TrendingUp} label="Peso Facturable (kg)" value={totalBillableKg} suffix=" kg" />
              <Card className="border-0 shadow-sm"><CardHeader><CardTitle>Nota</CardTitle></CardHeader><CardContent className="text-sm text-slate-600">Para envíos aéreos mostramos el peso facturable además del volumen CBM cuando esté disponible.</CardContent></Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}