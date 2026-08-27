import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';

// Estados con mayor interés según visitas acumuladas a sus landing pages
export default function StateInterestChart({ rows = [], limit = 10 }) {
  const data = useMemo(() => {
    const map = {};
    rows.forEach((r) => {
      if (!r.state_name) return;
      map[r.state_name] = (map[r.state_name] || 0) + (r.visit_count || 0);
    });
    return Object.entries(map)
      .map(([state, visitas]) => ({ state, visitas }))
      .sort((a, b) => b.visitas - a.visitas)
      .slice(0, limit);
  }, [rows, limit]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Estados con mayor interés</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="state" width={110} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="visitas" fill="hsl(var(--chart-2))" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}