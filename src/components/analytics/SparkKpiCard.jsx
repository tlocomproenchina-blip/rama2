import React, { useMemo, useId } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis } from "recharts";

export default function SparkKpiCard({ icon: Icon, label, value, prefix = "", suffix = "", sparkData = [], color = "#6366f1" }) {
  const reactId = useId();
  const gradientId = useMemo(() => `spark-${String(reactId).replace(/[:]/g, '')}`,[reactId]);
  const display = typeof value === 'number' ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value) : value;
  const data = sparkData && sparkData.length ? sparkData : [{ period: '—', value: 0 }];

  return (
    <Card className="border-0 rounded-2xl shadow-sm bg-gradient-to-br from-white to-slate-50 hover:shadow-lg transition-all">
      <CardContent className="p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="p-3.5 rounded-2xl bg-slate-100 ring-1 ring-slate-200 shrink-0">
            <Icon className="h-5 w-5 text-slate-700" />
          </div>
          <div className="min-w-0">
            <div className="text-xs text-slate-500 truncate">{label}</div>
            <div className="text-2xl font-semibold text-slate-900 tracking-tight truncate">{prefix}{display}{suffix}</div>
          </div>
        </div>
        <div className="h-12 w-28 md:w-32 lg:w-36">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.35}/>
                  <stop offset="95%" stopColor={color} stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="period" hide />
              <YAxis hide domain={["auto","auto"]} />
              <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} fill={`url(#${gradientId})`} isAnimationActive animationDuration={600} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}