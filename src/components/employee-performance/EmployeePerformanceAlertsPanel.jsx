import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const severityStyles = {
  high: 'bg-rose-100 text-rose-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-blue-100 text-blue-700',
};

export default function EmployeePerformanceAlertsPanel({ alerts }) {
  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600" /> Alertas proactivas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!(alerts || []).length ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
            No hay alertas para la fecha seleccionada.
          </div>
        ) : (
          alerts.map((alert) => (
            <div key={alert.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800">{alert.title}</p>
                  <p className="text-sm text-slate-500">{alert.employee_name || alert.employee_email}</p>
                </div>
                <Badge className={severityStyles[alert.severity] || severityStyles.medium}>{alert.severity}</Badge>
              </div>
              <p className="mt-3 text-sm text-slate-700">{alert.message}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}