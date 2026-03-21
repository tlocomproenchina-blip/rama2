import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function EmployeePerformanceLeaderboard({ metrics }) {
  const topItems = [...(metrics || [])]
    .sort((a, b) => (b.total_active_time_ms || 0) - (a.total_active_time_ms || 0))
    .slice(0, 5);

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle>Ranking del día</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {topItems.map((item, index) => (
          <div key={item.id || item.employee_email} className="flex items-center justify-between rounded-2xl bg-slate-50 p-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-800">#{index + 1} {item.employee_name || item.employee_email}</p>
              <p className="truncate text-sm text-slate-500">{item.employee_role || 'Sin rol'}</p>
            </div>
            <Badge className="bg-emerald-100 text-emerald-700">
              {((item.total_active_time_ms || 0) / 3600000).toFixed(1)} h
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}