import React from "react";
import { Card, CardContent } from "@/components/ui/card";

export default function KeyStat({ title, value, icon: Icon, subtitle, accent = "bg-blue-100 text-blue-700" }) {
  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">{title}</p>
            <p className="text-3xl font-bold text-slate-800">{value}</p>
            {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
          </div>
          <div className={`p-3 rounded-xl ${accent}`}>
            {Icon && <Icon className="h-6 w-6" />}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}