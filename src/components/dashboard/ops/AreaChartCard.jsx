import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

export default function AreaChartCard({ data }) {
  return (
    <div className="rounded-2xl border bg-white/90 backdrop-blur p-5 shadow-sm">
      <div className="mb-3">
        <p className="font-semibold text-slate-800">Evolución de Costos y Volumen</p>
        <p className="text-xs text-slate-500">Promedios diarios — hover para detalles</p>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="gradCost" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366F1" stopOpacity={0.35}/>
                <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="gradVol" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22C55E" stopOpacity={0.35}/>
                <stop offset="95%" stopColor="#22C55E" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="left" orientation="left" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
            <Tooltip contentStyle={{ borderRadius: 12 }} />
            <Legend />
            <Area type="monotone" yAxisId="left" dataKey="cost" name="Costos" stroke="#6366F1" fill="url(#gradCost)" strokeWidth={2} />
            <Area type="monotone" yAxisId="right" dataKey="volume" name="Volumen" stroke="#22C55E" fill="url(#gradVol)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}