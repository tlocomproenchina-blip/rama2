import React from "react";
import { Card, CardContent } from "@/components/ui/card";

export default function KpiCard({ title, value, subtitle, icon: Icon, accent = "blue" }) {
  const accentClasses = {
    blue: "bg-blue-100 text-blue-700",
    indigo: "bg-indigo-100 text-indigo-700",
    emerald: "bg-emerald-100 text-emerald-700",
    purple: "bg-purple-100 text-purple-700",
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
    slate: "bg-slate-100 text-slate-700",
  };

  return (
    <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-slate-500 text-sm truncate">{title}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1 truncate">{value}</p>
            {subtitle && <p className="text-xs text-slate-500 mt-1 truncate">{subtitle}</p>}
          </div>
          {Icon && (
            <div className={`p-3 rounded-xl ${accentClasses[accent] || accentClasses.blue}`}>
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}