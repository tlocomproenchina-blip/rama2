import React from "react";
import { Card, CardContent } from "@/components/ui/card";

export default function KpiCard({ icon: Icon, label, value, prefix = "", suffix = "" }) {
  const display = typeof value === 'number' ?
    new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value) : value;
  return (
    <Card className="border-0 rounded-2xl shadow-sm bg-gradient-to-br from-white to-slate-50 hover:shadow-lg transition-all">
      <CardContent className="p-5 flex items-center gap-4">
        <div className="p-3.5 rounded-2xl bg-slate-100 ring-1 ring-slate-200">
          <Icon className="h-5 w-5 text-slate-700"/>
        </div>
        <div>
          <div className="text-xs text-slate-500">{label}</div>
          <div className="text-2xl font-semibold text-slate-900 tracking-tight">{prefix}{display}{suffix}</div>
        </div>
      </CardContent>
    </Card>
  );
}