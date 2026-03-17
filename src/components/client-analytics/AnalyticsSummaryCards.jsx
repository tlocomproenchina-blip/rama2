import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

export default function AnalyticsSummaryCards({ items }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.title} className="border-0 shadow-md">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-500">{item.title}</p>
                  <p className="text-3xl font-bold text-slate-800">{item.value}</p>
                  {item.subtitle && <p className="mt-1 text-xs text-slate-500">{item.subtitle}</p>}
                </div>
                <div className={`rounded-2xl p-3 ${item.accent}`}>
                  <Icon className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}