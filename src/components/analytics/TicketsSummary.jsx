import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export default function TicketsSummary({ openCount = 0, closedCount = 0 }) {
  return (
    <Card className="border-0 rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle>Reclamos</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50">
            <div className="p-3 rounded-xl bg-amber-100"><AlertCircle className="h-5 w-5 text-amber-700"/></div>
            <div>
              <div className="text-xs text-slate-500">Abiertos / En Proceso</div>
              <div className="text-xl font-semibold text-slate-900">{openCount}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50">
            <div className="p-3 rounded-xl bg-emerald-100"><CheckCircle2 className="h-5 w-5 text-emerald-700"/></div>
            <div>
              <div className="text-xs text-slate-500">Resueltos / Cerrados</div>
              <div className="text-xl font-semibold text-slate-900">{closedCount}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}