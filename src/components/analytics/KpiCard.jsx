import React from "react";
import { Card, CardContent } from "@/components/ui/card";

export default function KpiCard({ icon: Icon, label, value, prefix = "", suffix = "" }) {
  const display = typeof value === 'number' ?
    new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value) : value;
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="p-3 rounded-lg bg-slate-100"><Icon className="h-5 w-5 text-slate-700"/></div>
        <div>
          <div className="text-xs text-slate-500">{label}</div>
          <div className="text-xl font-semibold text-slate-900">{prefix}{display}{suffix}</div>
        </div>
      </CardContent>
    </Card>
  );
}