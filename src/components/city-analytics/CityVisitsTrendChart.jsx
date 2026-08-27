import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';

// Tendencia de visitas diarias (últimos N días) a las landing pages de ciudades
export default function CityVisitsTrendChart({ dailyRows = [], days = 30 }) {
  const data = useMemo(() => {
    const map = {};
    dailyRows.forEach((r) => {
      if (!r.visit_date) return;
      map[r.visit_date] = (map[r.visit_date] || 0) + (r.visit_count || 0);
    });
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      out.push({
        date: key,
        label: d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' }),
        visitas: map[key] || 0
      });
    }
    return out;
  }, [dailyRows, days]);

  const total = data.reduce((acc, d) => acc + d.visitas, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tendencia de visitas ({days} días) — {total} visitas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="visitas" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}