import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { format, parseISO } from "date-fns";

function groupByMonth(items) {
  const map = new Map();
  items.forEach(c => {
    const d = c.shipping_date ? parseISO(c.shipping_date) : (c.created_date ? parseISO(c.created_date) : null);
    if (!d) return;
    const key = format(d, 'yyyy-MM');
    const prev = map.get(key) || { period: key, count: 0, cbm: 0 };
    prev.count += 1;
    prev.cbm += Number(c.cbm) || 0;
    map.set(key, prev);
  });
  return Array.from(map.values()).sort((a,b) => a.period.localeCompare(b.period));
}

export default function VolumeChart({ consolidations }) {
  const data = useMemo(() => groupByMonth(consolidations || []), [consolidations]);
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle>Volumen y Count por Mes</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <defs>
              <linearGradient id="volCbm" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.35}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.05}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Legend />
            <Area yAxisId="right" type="monotone" dataKey="cbm" name="CBM" stroke="#10b981" strokeWidth={3} fill="url(#volCbm)" animationDuration={700} />
            <Line yAxisId="left" type="monotone" dataKey="count" name="Consolidaciones" stroke="#6366f1" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} animationDuration={700} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}