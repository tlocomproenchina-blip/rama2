import React from 'react';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = ['#6366F1', '#22C55E', '#06B6D4', '#F59E0B', '#EF4444'];

export default function DonutChartCard({ data, onSliceClick }) {
  return (
    <div className="rounded-2xl border bg-white/90 backdrop-blur p-5 shadow-sm">
      <div className="mb-3">
        <p className="font-semibold text-slate-800">Distribución por Servicio</p>
        <p className="text-xs text-slate-500">Haz clic en un segmento para filtrar</p>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={3}
              onClick={(entry) => onSliceClick?.(entry?.name)}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="cursor-pointer" />
              ))}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: 12 }} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}