import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

const COLORS = ['#2563eb', '#f59e0b', '#ef4444'];

export default function ReceivablesOverview({ data, totalAmount }) {
  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle>Cuentas por cobrar</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[220px,1fr]">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="amount" nameKey="label" innerRadius={55} outerRadius={80} paddingAngle={4}>
                {data.map((entry, index) => <Cell key={entry.label} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(value) => `$${Number(value || 0).toFixed(2)}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Total pendiente: <span className="font-semibold text-slate-800">${totalAmount.toFixed(2)}</span></p>
          {data.map((item, index) => (
            <div key={item.label} className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="text-slate-700">{item.label}</span>
              </div>
              <div className="text-right">
                <p className="font-medium text-slate-800">${Number(item.amount || 0).toFixed(2)}</p>
                <p className="text-xs text-slate-500">{item.count} factura(s)</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}