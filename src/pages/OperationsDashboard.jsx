import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { generateSampleData, ALL_SERVICES } from '@/components/dashboard/ops/sampleData';
import FiltersPanel from '@/components/dashboard/ops/FiltersPanel';
import KpiCard from '@/components/dashboard/ops/KpiCard';
import AreaChartCard from '@/components/dashboard/ops/AreaChartCard';
import DonutChartCard from '@/components/dashboard/ops/DonutChartCard';
import GaugeCard from '@/components/dashboard/ops/GaugeCard';
import ClaimsTable from '@/components/dashboard/ops/ClaimsTable';
import { filterData, aggregateDaily, computeKPIs, distributionByService, claimsSummary, formatMoney, formatMoney2 } from '@/components/dashboard/ops/utils';

export default function OperationsDashboard() {
  const { shipments: allShipments, claims: allClaims } = useMemo(() => generateSampleData(90), []);

  const [filters, setFilters] = useState({ startDate: '', endDate: '', service: 'All' });
  const resetFilters = () => setFilters({ startDate: '', endDate: '', service: 'All' });

  const shipments = useMemo(() => filterData(allShipments, filters), [allShipments, filters]);
  const claims = useMemo(() => filterData(allClaims, filters), [allClaims, filters]);

  const series = useMemo(() => aggregateDaily(shipments), [shipments]);
  const kpis = useMemo(() => computeKPIs(shipments), [shipments]);
  const dist = useMemo(() => distributionByService(shipments), [shipments]);
  const claimSum = useMemo(() => claimsSummary(claims), [claims]);

  // Delivery score vs target days (lower avgDays is better)
  const targetDays = filters.service === 'Air DDP' ? 9 : filters.service === 'Maritime DDP' ? 22 : 14;
  const deliveryScore = kpis.avgDelivery ? Math.max(0, Math.min(100, (targetDays / kpis.avgDelivery) * 100)) : 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4 md:p-6 lg:p-8">
      <style>{`.card-enter{opacity:0;transform:translateY(8px)}.card-enter-active{opacity:1;transform:none;transition:all .4s ease}`}</style>
      <div className="max-w-[120rem] mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Operations Dashboard</h1>
          <p className="text-slate-600">Visión general de desempeño logístico</p>
        </div>

        <FiltersPanel filters={filters} setFilters={setFilters} services={ALL_SERVICES} onReset={resetFilters} />

        {/* KPIs */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 sm:col-span-6 lg:col-span-3"><KpiCard title="Total Shipments" primary={kpis.totalShipments.toLocaleString()} secondary={`Total Volume ${kpis.totalVolume.toFixed(1)}`} /></div>
          <div className="col-span-12 sm:col-span-6 lg:col-span-3"><KpiCard title="Total Costs" primary={formatMoney(kpis.totalCosts)} secondary={`Avg/Shipment ${formatMoney2(kpis.avgCostPerShipment)}`} /></div>
          <div className="col-span-12 sm:col-span-6 lg:col-span-3"><KpiCard title="Avg Delivery" primary={`${kpis.avgDelivery.toFixed(1)} days`} secondary={`Target ${targetDays}d`} /></div>
          <div className="col-span-12 sm:col-span-6 lg:col-span-3"><KpiCard title="Claims" primary={`${claimSum.openCount} open / ${claimSum.closedCount} closed`} secondary={`Top: ${claimSum.topCategory}`} /></div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-8"><AreaChartCard data={series} /></div>
          <div className="col-span-12 lg:col-span-4"><DonutChartCard data={dist} onSliceClick={(name)=> setFilters((f)=> ({...f, service: name}))} /></div>
        </div>

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 md:col-span-6"><GaugeCard title="On-time Rate" value={kpis.onTimeRate} caption="Entregas puntuales" accent="#0EA5E9" /></div>
          <div className="col-span-12 md:col-span-6"><GaugeCard title="Delivery Score" value={deliveryScore} caption={`Objetivo ${targetDays} días`} accent="#F59E0B" /></div>
        </div>

        {/* Claims */}
        <ClaimsTable claims={claims} />

      </div>
    </div>
  );
}