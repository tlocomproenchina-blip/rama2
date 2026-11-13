import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { METRIC_LABELS, metricsToShow } from './operationsConfig';

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-0.5 text-xs leading-tight text-slate-500">{label}</p>
    </div>
  );
}

export default function EmployeeOperationsCard({ employee }) {
  const { primary, extras } = metricsToShow(employee);
  const keys = [...primary, ...extras];

  return (
    <Card className="border-0 shadow-lg">
      <CardContent className="space-y-4 p-5">
        <div>
          <p className="font-semibold text-slate-900">{employee.name}</p>
          <p className="truncate text-xs text-slate-500">{employee.email}</p>
        </div>
        {employee.total === 0 && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">Sin actividad registrada en este periodo.</p>
        )}
        {keys.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {keys.map((key) => <Stat key={key} label={METRIC_LABELS[key]} value={employee.counts[key] || 0} />)}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Esta área no tiene tareas medibles todavía.</p>
        )}
      </CardContent>
    </Card>
  );
}