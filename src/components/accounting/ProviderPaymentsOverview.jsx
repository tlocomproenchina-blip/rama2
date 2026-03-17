import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function ProviderPaymentsOverview({ chartData, recentPayments }) {
  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle>Pagos de proveedores</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => [`$${Number(value || 0).toFixed(2)}`, 'Pagado']} />
              <Bar dataKey="amount" fill="#0f766e" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-3">
          {recentPayments.map((payment) => (
            <div key={payment.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <div>
                <p className="font-medium text-slate-800">{payment.provider_name}</p>
                <p className="text-slate-500">{new Date(payment.payment_date).toLocaleDateString()} · {payment.method}</p>
              </div>
              <p className="font-semibold text-slate-800">${Number(payment.total_amount || 0).toFixed(2)}</p>
            </div>
          ))}
          {recentPayments.length === 0 && <p className="text-sm text-slate-500">No hay pagos recientes.</p>}
        </div>
      </CardContent>
    </Card>
  );
}