import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, Tooltip, XAxis, YAxis, Legend } from "recharts";

export default function InvoicesVsPayments({ data }) {
  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-base md:text-lg">Facturación vs Pagos</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} tickFormatter={(v) => String(v).length > 12 ? String(v).slice(0,12) + '…' : String(v)} />
              <YAxis tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} width={52} />
              <Tooltip formatter={(v) => [`$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, ""]} />
              <Legend />
              <Bar dataKey="emitidas" name="Emitidas" fill="#3b82f6" radius={[4,4,0,0]} />
              <Bar dataKey="pagos" name="Pagos" fill="#10b981" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}