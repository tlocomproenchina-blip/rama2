import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function getTopEntries(source) {
  return Object.entries(source || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
}

export default function EmployeePerformanceDetail({ metric }) {
  if (!metric) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="p-8 text-center text-slate-500">Selecciona un empleado para ver su desglose.</CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle>{metric.employee_name || metric.employee_email}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs uppercase text-slate-400">Primera actividad</p><p className="mt-1 text-sm text-slate-700">{metric.first_activity_at ? new Date(metric.first_activity_at).toLocaleString('es-VE') : '—'}</p></div>
          <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs uppercase text-slate-400">Última actividad</p><p className="mt-1 text-sm text-slate-700">{metric.last_activity_at ? new Date(metric.last_activity_at).toLocaleString('es-VE') : '—'}</p></div>
          <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs uppercase text-slate-400">Sesiones</p><p className="mt-1 text-sm font-semibold text-slate-800">{metric.unique_sessions || 0}</p></div>
          <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs uppercase text-slate-400">Cambios en entidades</p><p className="mt-1 text-sm font-semibold text-slate-800">{metric.entity_changes || 0}</p></div>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">Módulos más usados</p>
          <div className="mt-2 space-y-2">{getTopEntries(metric.module_counts).map(([key, value]) => <div key={key} className="flex items-center justify-between rounded-xl bg-white border border-slate-200 px-3 py-2 text-sm"><span className="truncate pr-3">{key}</span><span className="font-semibold text-slate-700">{value}</span></div>)}</div>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">Páginas con más actividad</p>
          <div className="mt-2 space-y-2">{getTopEntries(metric.page_counts).map(([key, value]) => <div key={key} className="flex items-center justify-between rounded-xl bg-white border border-slate-200 px-3 py-2 text-sm"><span className="truncate pr-3">{key}</span><span className="font-semibold text-slate-700">{value}</span></div>)}</div>
        </div>
      </CardContent>
    </Card>
  );
}