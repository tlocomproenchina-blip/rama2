import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const tones = {
  blue: 'bg-blue-50 text-blue-700 border-blue-100',
  amber: 'bg-amber-50 text-amber-700 border-amber-100',
  rose: 'bg-rose-50 text-rose-700 border-rose-100',
  violet: 'bg-violet-50 text-violet-700 border-violet-100',
};

export default function PortalMetricCard({ title, value, subtitle, icon: Icon, tone = 'blue' }) {
  return (
    <Card className="border-border/70 bg-card/95 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-premium">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">{value}</p>
            {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className={cn('rounded-[1.15rem] border p-3 shadow-sm', tones[tone] || tones.blue)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}