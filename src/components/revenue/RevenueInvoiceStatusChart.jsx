import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const STATUS_CONFIG = {
  pagada: { label: 'Pagada', color: '#22c55e' },
  pendiente: { label: 'Pendiente', color: '#f59e0b' },
  vencida: { label: 'Vencida', color: '#ef4444' },
  revision: { label: 'En Revisión', color: '#8b5cf6' },
  cancelada: { label: 'Cancelada', color: '#94a3b8' },
};

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.[0]) return null;
  const { name, value, payload: item } = payload[0];
  return (
    <div className="bg-white/95 backdrop-blur border border-slate-200 rounded-xl px-3 py-2 shadow-lg">
      <p className="text-sm font-semibold text-slate-800">{name}</p>
      <p className="text-xs text-slate-500">{value} facturas ({item.percentage}%)</p>
      <p className="text-xs text-slate-500 font-mono">${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
    </div>
  );
}

export default function RevenueInvoiceStatusChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-slate-500">
          No hay datos de estado de facturas
        </CardContent>
      </Card>
    );
  }

  const total = data.reduce((s, d) => s + d.count, 0);
  const chartData = data.map(d => ({
    name: STATUS_CONFIG[d.status]?.label || d.status,
    value: d.count,
    amount: d.amount,
    percentage: total > 0 ? Math.round((d.count / total) * 100) : 0,
    fill: STATUS_CONFIG[d.status]?.color || '#94a3b8',
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Estado de Facturas</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={3}
              dataKey="value"
              strokeWidth={2}
              stroke="#fff"
            >
              {chartData.map((entry, idx) => (
                <Cell key={idx} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="bottom"
              iconType="circle"
              iconSize={8}
              formatter={(value) => <span className="text-xs text-slate-600">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="text-center -mt-4">
          <p className="text-2xl font-bold text-slate-800">{total}</p>
          <p className="text-[11px] text-slate-400">Total facturas</p>
        </div>
      </CardContent>
    </Card>
  );
}