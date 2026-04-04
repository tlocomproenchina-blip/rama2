import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';

export default function AdminDashboardQuickLink({ to, title, description, icon: Icon, tone = 'blue' }) {
  const tones = {
    blue: 'from-blue-50 to-cyan-50 text-blue-700',
    emerald: 'from-emerald-50 to-teal-50 text-emerald-700',
    violet: 'from-violet-50 to-fuchsia-50 text-violet-700',
    amber: 'from-amber-50 to-orange-50 text-amber-700',
  };

  return (
    <Link to={to}>
      <Card className="h-full border-border/70 bg-white/90 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-premium">
        <CardContent className="p-5">
          <div className={`inline-flex rounded-2xl bg-gradient-to-br p-3 ${tones[tone] || tones.blue}`}>
            <Icon className="h-5 w-5" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}