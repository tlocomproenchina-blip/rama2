import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2, BarChart3, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import RevenueSummaryCards from '@/components/revenue/RevenueSummaryCards';
import RevenueMonthlyChart from '@/components/revenue/RevenueMonthlyChart';
import RevenueClientTable from '@/components/revenue/RevenueClientTable';
import RevenueMonthFilter from '@/components/revenue/RevenueMonthFilter';
import RevenueInvoiceStatusChart from '@/components/revenue/RevenueInvoiceStatusChart';
import RevenueCumulativeChart from '@/components/revenue/RevenueCumulativeChart';

function computePreviousPeriod(startMonth, endMonth) {
  if (!startMonth || !endMonth) return null;
  const [sy, sm] = startMonth.split('-').map(Number);
  const [ey, em] = endMonth.split('-').map(Number);
  const totalMonths = (ey - sy) * 12 + (em - sm) + 1;

  // Previous period = same duration right before startMonth
  let prevEndM = sm - 1;
  let prevEndY = sy;
  if (prevEndM <= 0) { prevEndM += 12; prevEndY -= 1; }

  let prevStartM = prevEndM - totalMonths + 1;
  let prevStartY = prevEndY;
  while (prevStartM <= 0) { prevStartM += 12; prevStartY -= 1; }

  return {
    startMonth: `${prevStartY}-${String(prevStartM).padStart(2, '0')}`,
    endMonth: `${prevEndY}-${String(prevEndM).padStart(2, '0')}`,
  };
}

export default function AdminRevenueDashboard({ user }) {
  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');

  const { data, isLoading, error, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['revenueMetrics-v2', startMonth, endMonth],
    queryFn: async () => {
      const params = {};
      if (startMonth) params.startMonth = startMonth;
      if (endMonth) params.endMonth = endMonth;
      const res = await base44.functions.invoke('getRevenueMetrics', params);
      const result = res?.data ?? res;
      if (result?.summary) {
        result.summary.insuranceProfit = Number(result.summary.insuranceProfit) || 0;
      }
      return result;
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });

  // Fetch previous period for comparison
  const prevPeriod = computePreviousPeriod(startMonth, endMonth);
  const { data: prevData } = useQuery({
    queryKey: ['revenueMetrics-v2', 'prev', prevPeriod?.startMonth, prevPeriod?.endMonth],
    queryFn: async () => {
      if (!prevPeriod) return null;
      const res = await base44.functions.invoke('getRevenueMetrics', prevPeriod);
      const result = res?.data ?? res;
      if (result?.summary) {
        result.summary.insuranceProfit = Number(result.summary.insuranceProfit) || 0;
      }
      return result;
    },
    enabled: !!prevPeriod,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });

  const handleRefresh = useCallback(() => refetch(), [refetch]);

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            Dashboard de Rendimiento
          </h1>
          <p className="text-slate-500 mt-1">Ingresos, CBM procesados y facturación pendiente</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && !isLoading && (
            <span className="text-[11px] text-slate-400">Actualizado {lastUpdated}</span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Filters */}
      <RevenueMonthFilter
        startMonth={startMonth}
        endMonth={endMonth}
        onStartChange={setStartMonth}
        onEndChange={setEndMonth}
        onReset={() => { setStartMonth(''); setEndMonth(''); }}
      />

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-slate-500">Cargando métricas...</p>
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <p className="text-red-500 mb-3">Error al cargar datos: {error.message}</p>
          <Button variant="outline" onClick={handleRefresh}>Reintentar</Button>
        </div>
      ) : (
        <>
          <RevenueSummaryCards summary={data?.summary} previousSummary={prevData?.summary} />
          <RevenueMonthlyChart data={data?.monthlyData} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <RevenueCumulativeChart data={data?.monthlyData} />
            </div>
            <RevenueInvoiceStatusChart data={data?.invoiceStatusData} />
          </div>
          <RevenueClientTable data={data?.clientData} />
        </>
      )}
    </div>
  );
}