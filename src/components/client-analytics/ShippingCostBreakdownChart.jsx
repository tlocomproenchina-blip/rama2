import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

export default function ShippingCostBreakdownChart({ data }) {
  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle>Histórico de costos de envío</CardTitle>
      </CardHeader>
      <CardContent className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value) => `$${Number(value || 0).toFixed(2)}`} />
            <Legend />
            <Bar dataKey="shipping" name="Envío" fill="#0f766e" radius={[6, 6, 0, 0]} />
            <Bar dataKey="insurance" name="Seguro" fill="#f59e0b" radius={[6, 6, 0, 0]} />
            <Bar dataKey="total" name="Total" fill="#2563eb" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}