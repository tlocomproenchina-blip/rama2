import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Package, Truck, Clock } from "lucide-react";

function tzFormat(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('es-VE', { timeZone: 'America/Caracas' });
  } catch {
    return dateStr || '';
  }
}

const typeIcon = {
  user: Users,
  package: Package,
  consolidation: Truck,
};

export default function RecentActivity({ items = [] }) {
  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-slate-700">Actividad reciente</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {items.length === 0 ? (
          <div className="text-sm text-slate-500 p-3">Sin actividad reciente</div>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden">
            {items.map((it, idx) => {
              const Icon = typeIcon[it.type] || Clock;
              return (
                <li key={idx} className="flex items-start gap-3 p-3 min-w-0">
                  <div className="mt-0.5 h-9 w-9 shrink-0 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-slate-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-800 break-words">{it.title}</div>
                    {it.description && (
                      <div className="text-xs text-slate-500 break-all">{it.description}</div>
                    )}
                    <div className="mt-1 text-[11px] text-slate-400 sm:hidden">{tzFormat(it.date)}</div>
                  </div>
                  <div className="hidden sm:block text-xs text-slate-500 shrink-0 text-right pl-2 max-w-[96px] overflow-hidden text-ellipsis whitespace-nowrap sm:max-w-full">{tzFormat(it.date)}</div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}