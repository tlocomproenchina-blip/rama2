import React from 'react';
import { Truck, TrendingUp, MessageCircle } from 'lucide-react';
import MetricCard from '@/components/dashboard/MetricCard';

export default function AdminPlatformOverview({ totalShippingVolume, projectedMonthlyRevenue, openSupportTickets }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <MetricCard
        title="Volumen total de envíos"
        value={`${Number(totalShippingVolume || 0).toFixed(2)} CBM`}
        subtitle="Consolidaciones registradas"
        icon={Truck}
      />
      <MetricCard
        title="Ingresos mensuales proyectados"
        value={`$${Number(projectedMonthlyRevenue || 0).toFixed(2)}`}
        subtitle="Proyección del mes actual"
        icon={TrendingUp}
      />
      <MetricCard
        title="Tickets de soporte abiertos"
        value={String(openSupportTickets || 0)}
        subtitle="Pendientes de atención"
        icon={MessageCircle}
      />
    </div>
  );
}