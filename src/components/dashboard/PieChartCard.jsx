import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

const DEFAULT_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#f97316"
];

export default function PieChartCard({ title, data, dataKey = "value", nameKey = "name", colors = DEFAULT_COLORS }) {
  return (
    <Card className="border-0 shadow-md overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-slate-700">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 min-w-0 overflow-hidden">
        <div className="h-56 sm:h-64 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey={dataKey} nameKey={nameKey} innerRadius={42} outerRadius={72} paddingAngle={3}>
                {data.map((_, i) => (
                  <Cell key={`cell-${i}`} fill={colors[i % colors.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs sm:text-sm">
          {data.map((item, i) => (
            <div key={`${item[nameKey]}-${i}`} className="flex items-center gap-2 min-w-0">
              <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: colors[i % colors.length] }} />
              <span className="text-slate-600">{item[nameKey]}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}