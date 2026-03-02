import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Legend, Bar } from "recharts";

export default function RevenueTrendChart({ data }) {
  return (
    <Card className="bg-white/90 backdrop-blur border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base md:text-lg">Ingresos vs Pagos (por día)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 md:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `$${v}`} width={60} />
              <Tooltip formatter={(v) => `$${Number(v).toFixed(2)}`} />
              <Legend />
              <Bar dataKey="invoiced" name="Facturado" fill="#3b82f6" radius={[4,4,0,0]} />
              <Bar dataKey="paid" name="Pagado" fill="#10b981" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}