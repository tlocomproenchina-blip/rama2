import React from 'react';
import { Card, CardContent } from "@/components/ui/card";

const toneClasses = {
  blue: { card: 'from-blue-50 to-white', icon: 'bg-blue-100 text-blue-600' },
  indigo: { card: 'from-indigo-50 to-white', icon: 'bg-indigo-100 text-indigo-600' },
  emerald: { card: 'from-emerald-50 to-white', icon: 'bg-emerald-100 text-emerald-600' },
  green: { card: 'from-green-50 to-white', icon: 'bg-green-100 text-green-600' },
};

export default function TrackingStatsCard({ label, value, icon: Icon, tone = 'blue' }) {
  const styles = toneClasses[tone] || toneClasses.blue;

  return (
    <Card className={`border-0 shadow-md bg-gradient-to-br ${styles.card}`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">{label}</p>
            <p className="text-3xl font-bold text-slate-900">{value}</p>
          </div>
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${styles.icon}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}