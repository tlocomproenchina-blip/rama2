import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Package, Clock, Users, FileText, TrendingUp, TrendingDown, Minus, Ship, Shield } from 'lucide-react';

const cards = [
  { key: 'totalRevenue', label: 'Ingresos Cobrados', icon: DollarSign, color: 'text-green-600 bg-green-50 border-green-100', prefix: '$', isCurrency: true },
  { key: 'shippingProfit', label: 'Ganancia Envíos', sublabelKey: 'totalProviderCost', icon: Ship, color: 'text-cyan-600 bg-cyan-50 border-cyan-100', prefix: '$', isCurrency: true },
  { key: 'insuranceProfit', label: 'Seguros Cobrados', icon: Shield, color: 'text-teal-600 bg-teal-50 border-teal-100', prefix: '$', isCurrency: true },
  { key: 'totalPending', label: 'Pendiente de Cobro', icon: Clock, color: 'text-orange-600 bg-orange-50 border-orange-100', prefix: '$', isCurrency: true },
  { key: 'totalCbm', label: 'CBM Procesados', icon: Package, color: 'text-blue-600 bg-blue-50 border-blue-100', suffix: ' CBM', decimals: 2 },
  { key: 'totalInvoices', label: 'Facturas Emitidas', icon: FileText, color: 'text-purple-600 bg-purple-50 border-purple-100' },
  { key: 'totalClients', label: 'Clientes Activos', icon: Users, color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
];

function formatNumber(value, opts = {}) {
  if (typeof value !== 'number') return value ?? '—';
  const { isCurrency, decimals } = opts;
  if (isCurrency) {
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals ?? 0,
    maximumFractionDigits: decimals ?? 0,
  });
}

function computeChange(current, previous) {
  if (previous == null || current == null) return null;
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return 100;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

function TrendIndicator({ change }) {
  if (change == null) return null;
  if (change === 0) return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-400">
      <Minus className="h-3 w-3" /> 0%
    </span>
  );
  const isPositive = change > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
      {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isPositive ? '+' : ''}{change}%
    </span>
  );
}

export default function RevenueSummaryCards({ summary, previousSummary }) {
  if (!summary) return null;

  const normalizedSummary = {
    ...summary,
    insuranceProfit: Number(summary.insuranceProfit) || 0,
    shippingProfit: Number(summary.shippingProfit) || (Math.round(((Number(summary.totalProfit) || 0) - (Number(summary.insuranceProfit) || 0)) * 100) / 100),
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {cards.map(({ key, label, sublabelKey, breakdown, icon: Icon, color, prefix, suffix, isCurrency, decimals }) => {
        const change = previousSummary ? computeChange(normalizedSummary[key], previousSummary[key]) : null;
        return (
          <Card key={key} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2 rounded-xl border ${color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <TrendIndicator change={change} />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-slate-800 truncate leading-tight">
                {prefix}{formatNumber(normalizedSummary[key], { isCurrency, decimals })}{suffix}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">{label}</p>
              {breakdown && (
                <div className="mt-1 space-y-0.5">
                  {breakdown.map(({ key: bKey, label: bLabel, textColor }) => (
                    typeof normalizedSummary[bKey] === 'number' && (
                      <p key={bKey} className={`text-[10px] font-medium ${textColor || 'text-emerald-700'}`}>
                        {bLabel}: ${formatNumber(normalizedSummary[bKey], { isCurrency: true })}
                      </p>
                    )
                  ))}
                </div>
              )}
              {sublabelKey && typeof normalizedSummary[sublabelKey] === 'number' && (
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Costo proveedor: ${formatNumber(normalizedSummary[sublabelKey], { isCurrency: true })}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}