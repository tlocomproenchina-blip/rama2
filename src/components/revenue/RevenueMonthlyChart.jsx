import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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
    <div className="bg-white/95 backdrop-blur border border-slate-200 rounded-xl px-3 py-2.5 shadow-lg min-w-[160px]">
      <p className="text-xs font-semibold text-slate-700 mb-1.5 border-b border-slate-100 pb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="text-xs font-mono font-semibold" style={{ color: p.color }}>
            {p.name === 'CBM' ? `${p.value.toFixed(2)}` : `$${p.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function RevenueMonthlyChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-slate-500">
          No hay datos mensuales para mostrar
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map(d => ({
    ...d,
    label: formatMonth(d.month),
    total: (d.revenue || 0) + (d.pending || 0),
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Revenue bars + total line */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Ingresos Mensuales</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="barRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0.6} />
                </linearGradient>
                <linearGradient id="barPending" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.6} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} formatter={v => <span className="text-xs text-slate-600">{v}</span>} />
              <Bar dataKey="revenue" name="Cobrado" fill="url(#barRevenue)" radius={[6, 6, 0, 0]} barSize={20} />
              <Bar dataKey="pending" name="Pendiente" fill="url(#barPending)" radius={[6, 6, 0, 0]} barSize={20} />
              <Line type="monotone" dataKey="total" name="Total" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: '#6366f1' }} strokeDasharray="4 4" />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* CBM bars */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">CBM Procesados por Mes</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="barCbm" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.5} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} formatter={v => <span className="text-xs text-slate-600">{v}</span>} />
              <Bar dataKey="cbm" name="CBM" fill="url(#barCbm)" radius={[6, 6, 0, 0]} barSize={28} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}