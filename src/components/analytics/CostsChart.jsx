import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { format, parseISO } from "date-fns";

function groupCostsByMonth(items) {
  const map = new Map();
  items.forEach(c => {
    const d = c.shipping_date ? parseISO(c.shipping_date) : (c.created_date ? parseISO(c.created_date) : null);
    if (!d) return;
    const key = format(d, 'yyyy-MM');
    const prev = map.get(key) || { period: key, total_cost: 0, shipping_cost: 0, insurance_cost: 0 };
    prev.total_cost += Number(c.total_cost) || 0;
    prev.shipping_cost += Number(c.shipping_cost) || 0;
    prev.insurance_cost += Number(c.insurance_cost) || 0;
    map.set(key, prev);
  });
  return Array.from(map.values()).sort((a,b) => a.period.localeCompare(b.period));
}

export default function CostsChart({ consolidations }) {
  const data = useMemo(() => groupCostsByMonth(consolidations || []), [consolidations]);
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle>Costos por Mes</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorA" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05}/>
              </linearGradient>
              <linearGradient id="colorB" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.05}/>
              </linearGradient>
              <linearGradient id="colorC" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" />
            <YAxis />
            <Tooltip formatter={(v)=>`$${new Intl.NumberFormat().format(v)}`}/>
            <Legend />
            <Area type="monotone" dataKey="total_cost" name="Total" stroke="#6366f1" strokeWidth={3} fill="url(#colorA)" dot={{ r: 2 }} activeDot={{ r: 4 }} animationDuration={800} />
            <Area type="monotone" dataKey="shipping_cost" name="Flete" stroke="#10b981" strokeWidth={3} fill="url(#colorB)" dot={{ r: 2 }} activeDot={{ r: 4 }} animationDuration={800} />
            <Area type="monotone" dataKey="insurance_cost" name="Seguro" stroke="#f59e0b" strokeWidth={3} fill="url(#colorC)" dot={{ r: 2 }} activeDot={{ r: 4 }} animationDuration={800} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}