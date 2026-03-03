import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar } from "recharts";
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
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Legend />
            <Bar yAxisId="left" dataKey="count" name="Consolidaciones" fill="#6366f1" />
            <Bar yAxisId="right" dataKey="cbm" name="CBM" fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}