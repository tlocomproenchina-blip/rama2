import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, DollarSign, TrendingUp, ShieldCheck } from 'lucide-react';

// Resumen de facturas: totales, pagadas, pendientes, ingresos, ganancia y seguro.
const cards = [
  { key: 'total', label: 'Total Facturas', icon: FileText, tone: 'text-blue-600' },
  { key: 'paid', label: 'Pagadas', icon: DollarSign, tone: 'text-green-600' },
  { key: 'pending', label: 'Pendientes', icon: FileText, tone: 'text-yellow-600' },
  { key: 'revenue', label: 'Ingresos', icon: TrendingUp, tone: 'text-emerald-600', money: true },
  { key: 'profit', label: 'Ganancia', icon: TrendingUp, tone: 'text-purple-600', money: true },
  { key: 'insuranceCollected', label: 'Seguro Cobrado', icon: ShieldCheck, tone: 'text-cyan-600', money: true },
];

export default function InvoiceStatsCards({ stats }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map(({ key, label, icon: Icon, tone, money }) => (
        <Card key={key} className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{label}</p>
                <p className={`text-2xl font-bold ${tone}`}>
                  {money ? `$${Number(stats?.[key] || 0).toFixed(2)}` : Number(stats?.[key] || 0)}
                </p>
              </div>
              <Icon className={`h-8 w-8 ${tone}`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}