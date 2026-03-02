import React from "react";
import { Card, CardContent } from "@/components/ui/card";

export default function MetricCard({ title, value, icon: Icon, subtitle, className = "" }) {
  return (
    <Card className={`border-0 shadow-md ${className}`}>
      <CardContent className="p-4 md:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs md:text-sm text-slate-500 truncate">{title}</p>
            <p className="text-2xl md:text-3xl font-bold text-slate-800 leading-tight">{value}</p>
            {subtitle ? (
              <p className="text-xs text-slate-500 mt-1 truncate">{subtitle}</p>
            ) : null}
          </div>
          {Icon ? (
            <div className="p-3 bg-slate-100 rounded-xl flex-shrink-0">
              <Icon className="h-5 w-5 text-slate-600" />
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}