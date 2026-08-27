import React, { useMemo } from 'react';
import { CITY_LANDINGS } from '@/lib/cityLandings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer } from 'recharts';
import { LineChart as LineChartIcon } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

// Tendencia diaria de visitas por ciudad (Google Analytics), top ciudades
export default function GaCityTrendChart({ daily = [], topSlugs = [], days = 30 }) {
  const cityName = (slug) => CITY_LANDINGS.find((c) => c.slug === slug)?.city || slug;
  const slugs = topSlugs.slice(0, 6);

  const data = useMemo(() => {
    const byDate = {};
    daily.forEach((d) => {
      if (!slugs.includes(d.slug)) return;
      byDate[d.date] = byDate[d.date] || {};
      byDate[d.date][d.slug] = (byDate[d.date][d.slug] || 0) + d.pageviews;
    });
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const dt = new Date();
      dt.setDate(dt.getDate() - i);
      const key = dt.toISOString().slice(0, 10);
      const row = {
        label: dt.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' })
      };
      slugs.forEach((s) => { row[cityName(s)] = byDate[key]?.[s] || 0; });
      out.push(row);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daily, topSlugs.join(','), days]);

  if (slugs.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <LineChartIcon className="h-4 w-4 text-blue-600" /> Tendencia de visitas por ciudad ({days} días)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              {slugs.map((s, i) => (
                <Line
                  key={s}
                  type="monotone"
                  dataKey={cityName(s)}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}