import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const monthNames = {
  '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr', '05': 'May', '06': 'Jun',
  '07': 'Jul', '08': 'Ago', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
};

function formatMonth(m) {
  if (!m) return '';
  const [y, mo] = m.split('-');
  return `${monthNames[mo] || mo} ${y}`;
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur border border-slate-200 rounded-xl px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs" style={{ color: p.color }}>
          {p.name}: <span className="font-mono font-semibold">${p.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </p>
      ))}
    </div>
  );
}

export default function RevenueCumulativeChart({ data }) {
  if (!data || data.length === 0) return null;

  let cumRevenue = 0;
  let cumPending = 0;
  const chartData = data.map(d => {
    cumRevenue += d.revenue || 0;
    cumPending += d.pending || 0;
    return {
      label: formatMonth(d.month),
      cumRevenue: Math.round(cumRevenue * 100) / 100,
      cumPending: Math.round(cumPending * 100) / 100,
    };
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Tendencia Acumulada</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradPending" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="cumRevenue"
              name="Cobrado Acum."
              stroke="#22c55e"
              strokeWidth={2.5}
              fill="url(#gradRevenue)"
            />
            <Area
              type="monotone"
              dataKey="cumPending"
              name="Pendiente Acum."
              stroke="#f59e0b"
              strokeWidth={2}
              fill="url(#gradPending)"
              strokeDasharray="5 5"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}