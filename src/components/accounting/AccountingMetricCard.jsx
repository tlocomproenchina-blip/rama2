import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

export default function AccountingMetricCard({ title, value, subtitle, icon: Icon, accent }) {
  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">{title}</p>
            <p className="text-3xl font-bold text-slate-800">{value}</p>
            {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
          </div>
          <div className={`rounded-2xl p-3 ${accent}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}