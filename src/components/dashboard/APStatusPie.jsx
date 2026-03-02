import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip } from "recharts";

const COLORS = {
  pendiente: "#f59e0b",
  parcial: "#3b82f6",
  pagado: "#10b981",
  vencido: "#ef4444",
  disputa: "#f43f5e",
  otros: "#64748b"
};

export default function APStatusPie({ data }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  return (
    <Card className="bg-white/90 backdrop-blur border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base md:text-lg">Cuentas por Pagar por estado</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 md:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e) => `${e.name} ${(e.value/total*100).toFixed(0)}%`}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[entry.name] || COLORS.otros} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => `$${Number(v).toFixed(2)}`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}