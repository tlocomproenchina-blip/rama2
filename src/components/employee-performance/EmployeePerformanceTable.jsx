import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function EmployeePerformanceTable({ metrics, selectedEmail, onSelect }) {
  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle>Detalle por empleado</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {(metrics || []).map((item) => {
          const isActive = selectedEmail === item.employee_email;
          return (
            <button
              key={item.id || item.employee_email}
              type="button"
              onClick={() => onSelect(item.employee_email)}
              className={`w-full rounded-2xl border p-4 text-left transition-all ${isActive ? 'border-primary bg-accent/60 shadow-sm' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-800">{item.employee_name || item.employee_email}</p>
                  <p className="truncate text-sm text-slate-500">{item.employee_email}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{item.employee_role || 'Sin rol'}</Badge>
                  <Badge className="bg-blue-100 text-blue-700">{item.total_events || 0} eventos</Badge>
                  <Badge className="bg-emerald-100 text-emerald-700">{((item.total_active_time_ms || 0) / 3600000).toFixed(1)} h</Badge>
                  <Badge className="bg-amber-100 text-amber-700">{Number(item.active_efficiency_pct || 0).toFixed(0)}%</Badge>
                </div>
              </div>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}