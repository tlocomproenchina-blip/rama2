import React from 'react';
import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts';

export default function GaugeCard({ title, value, suffix = '%', accent = '#10B981', caption }) {
  const data = [{ name: title, value: Math.max(0, Math.min(100, value)) }];
  return (
    <div className="rounded-2xl border bg-white/90 backdrop-blur p-5 shadow-sm">
      <p className="font-semibold text-slate-800 mb-3">{title}</p>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart innerRadius="70%" outerRadius="100%" data={data} startAngle={180} endAngle={0}>
            <RadialBar dataKey="value" cornerRadius={10} fill={accent} background clockWise />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      <div className="-mt-24 text-center">
        <div className="text-3xl font-bold text-slate-900">{Math.round(data[0].value)}{suffix}</div>
        {caption && <div className="text-xs text-slate-600 mt-1">{caption}</div>}
      </div>
    </div>
  );
}