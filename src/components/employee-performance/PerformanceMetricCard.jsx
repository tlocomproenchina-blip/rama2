import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

export default function PerformanceMetricCard({ title, value, subtitle, accent = 'bg-blue-100 text-blue-700' }) {
  return (
    <Card className="border-0 shadow-lg">
      <CardContent className="p-5">
        <div className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${accent}`}>
          {title}
        </div>
        <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </CardContent>
    </Card>
  );
}