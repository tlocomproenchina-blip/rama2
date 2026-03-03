import React from 'react';

export default function KpiCard({ title, primary, secondary, chip }) {
  return (
    <div className="rounded-2xl border bg-white/90 backdrop-blur p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
        {chip && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border">{chip}</span>}
      </div>
      <div className="text-2xl font-bold text-slate-900">{primary}</div>
      {secondary && <div className="text-sm text-slate-600 mt-1">{secondary}</div>}
    </div>
  );
}