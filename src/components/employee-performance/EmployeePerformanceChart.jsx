import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function EmployeePerformanceChart({ metrics }) {
  const data = (metrics || []).slice(0, 8).map((item) => ({
    name: (item.employee_name || item.employee_email || 'Sin nombre').split(' ')[0],
    horas: Number(((item.total_active_time_ms || 0) / 3600000).toFixed(2)),
  }));

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle>Horas activas por empleado</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip formatter={(value) => [`${value} h`, 'Horas activas']} />
              <Bar dataKey="horas" fill="hsl(var(--primary))" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}