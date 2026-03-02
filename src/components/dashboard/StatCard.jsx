import React from "react";
import { Card, CardContent } from "@/components/ui/card";

export default function StatCard({ title, value, subtitle, Icon, colorClass = "text-blue-600" }) {
  return (
    <Card className="bg-white/90 backdrop-blur border shadow-sm">
      <CardContent className="p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
            <p className="mt-1 text-2xl md:text-3xl font-semibold text-slate-800">{value}</p>
            {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {Icon ? (
            <div className={`h-10 w-10 md:h-12 md:w-12 rounded-lg bg-slate-50 flex items-center justify-center ${colorClass}`}>
              <Icon className="h-5 w-5 md:h-6 md:w-6" />
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}