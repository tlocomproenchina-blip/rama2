import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function AdminDashboardMetricCard({ title, value, subtitle, icon: Icon, tone = 'blue', badge }) {
  const tones = {
    blue: 'from-blue-50 to-cyan-50 text-blue-700 border-blue-200',
    emerald: 'from-emerald-50 to-teal-50 text-emerald-700 border-emerald-200',
    amber: 'from-amber-50 to-orange-50 text-amber-700 border-amber-200',
    violet: 'from-violet-50 to-fuchsia-50 text-violet-700 border-violet-200',
    rose: 'from-rose-50 to-pink-50 text-rose-700 border-rose-200',
    slate: 'from-slate-50 to-slate-100 text-slate-700 border-slate-200',
  };

  return (
    <Card className="overflow-hidden border-border/70 bg-white/90 shadow-card">
      <CardContent className="p-0">
        <div className={`border-b bg-gradient-to-br p-5 ${tones[tone] || tones.blue}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] opacity-80">{title}</p>
              <p className="mt-3 text-3xl font-bold leading-none text-slate-900">{value}</p>
            </div>
            {Icon ? (
              <div className="rounded-2xl bg-white/80 p-3 shadow-sm">
                <Icon className="h-5 w-5" />
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 p-5">
          <p className="text-sm text-muted-foreground">{subtitle}</p>
          {badge ? <Badge variant="outline">{badge}</Badge> : null}
        </div>
      </CardContent>
    </Card>
  );
}