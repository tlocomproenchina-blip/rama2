import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";

const STATUS_LABELS = {
  pendiente: "Pendiente",
  parcial: "Parcial",
  pagado: "Pagado",
  vencido: "Vencido",
  disputa: "Disputa",
};

export default function ApStatusChart({ data }) {
  const chartData = Object.keys(STATUS_LABELS).map((k) => ({
    status: STATUS_LABELS[k],
    monto: data[k]?.monto || 0,
  }));

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-base md:text-lg">Cuentas por Pagar por Estado</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-72 min-w-[1px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="status" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} width={52} />
              <Tooltip formatter={(v) => [`$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, "Monto"]} />
              <Bar dataKey="monto" name="Monto" fill="#f59e0b" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}