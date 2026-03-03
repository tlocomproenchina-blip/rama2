import React, { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, DollarSign, Clock, MessageSquare } from "lucide-react";

function formatNumber(n) {
  return (n ?? 0).toLocaleString();
}

function daysBetween(a, b) {
  const ms = b.getTime() - a.getTime();
  return ms / (1000 * 60 * 60 * 24);
}

export default function KeyMetrics({ consolidations = [], supportTickets = [], filters }) {
  const { startDate, endDate, serviceType } = filters || {};
  const start = startDate ? new Date(startDate + 'T00:00:00') : null;
  const end = endDate ? new Date(endDate + 'T23:59:59') : null;

  const filteredConsolidations = useMemo(() => {
    return consolidations.filter((c) => {
      if (!c?.shipping_date) return false;
      const d = new Date(c.shipping_date);
      const inDate = (!start || d >= start) && (!end || d <= end);
      const typeOk = serviceType === 'todos' || c?.shipping_type === serviceType;
      return inDate && typeOk;
    });
  }, [consolidations, start?.getTime?.(), end?.getTime?.(), serviceType]);

  const metrics = useMemo(() => {
    const volume = filteredConsolidations.length;
    const totalCosts = filteredConsolidations.reduce((acc, c) => acc + (Number(c.total_cost) || 0), 0);

    const delivered = filteredConsolidations.filter(
      (c) => c.status === 'entregado' && c.shipping_date && c.updated_date
    );
    const avgDays = delivered.length > 0
      ? delivered.reduce((acc, c) => acc + daysBetween(new Date(c.shipping_date), new Date(c.updated_date)), 0) / delivered.length
      : null;

    // Tickets por rango de fechas usando created_date (campo builtin)
    const filteredTickets = supportTickets.filter((t) => {
      const cd = t?.created_date ? new Date(t.created_date) : null;
      if (!cd) return false;
      return (!start || cd >= start) && (!end || cd <= end);
    });

    const openStatuses = new Set(['abierto', 'en_proceso']);
    const closedStatuses = new Set(['resuelto', 'cerrado']);
    const openCount = filteredTickets.filter((t) => openStatuses.has(t.status)).length;
    const closedCount = filteredTickets.filter((t) => closedStatuses.has(t.status)).length;

    return { volume, totalCosts, avgDays, openCount, closedCount };
  }, [filteredConsolidations, supportTickets, start?.getTime?.(), end?.getTime?.()]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 lg:gap-4 mb-3 md:mb-4 lg:mb-6">
      <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
        <CardContent className="p-3 md:p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-slate-500">Volumen de envíos</p>
              <p className="text-xl md:text-3xl font-bold text-slate-800">{formatNumber(metrics.volume)}</p>
            </div>
            <div className="p-2 bg-indigo-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-indigo-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
        <CardContent className="p-3 md:p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-slate-500">Costos totales (USD)</p>
              <p className="text-xl md:text-3xl font-bold text-slate-800">${formatNumber(Math.round(metrics.totalCosts))}</p>
            </div>
            <div className="p-2 bg-emerald-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
        <CardContent className="p-3 md:p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-slate-500">Tiempo prom. entrega</p>
              <p className="text-xl md:text-3xl font-bold text-slate-800">{metrics.avgDays != null ? `${metrics.avgDays.toFixed(1)} d` : 'N/D'}</p>
            </div>
            <div className="p-2 bg-amber-100 rounded-lg">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
        <CardContent className="p-3 md:p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-slate-500">Reclamos (abiertos / cerrados)</p>
              <p className="text-xl md:text-3xl font-bold text-slate-800">{formatNumber(metrics.openCount)} / {formatNumber(metrics.closedCount)}</p>
            </div>
            <div className="p-2 bg-rose-100 rounded-lg">
              <MessageSquare className="h-5 w-5 text-rose-600" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}