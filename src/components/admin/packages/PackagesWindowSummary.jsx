import React from 'react';
import { Card, CardContent } from "@/components/ui/card";

export default function PackagesWindowSummary({ summary }) {
  if (!summary) return null;
  const fmtDate = (d) => new Date(d).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
  const fmtTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <Card className="border-0 shadow-sm bg-amber-50/60">
      <CardContent className="p-4 flex flex-wrap gap-6 text-sm text-slate-700">
        <div>
          <span className="font-medium">Primer recibido:</span>{' '}
          {fmtDate(summary.first)} {fmtTime(summary.first)}
        </div>
        <div>
          <span className="font-medium">Fin ventana (7 días):</span>{' '}
          {fmtDate(summary.end)} {fmtTime(summary.end)}
        </div>
        <div>
          <span className="font-medium">Días restantes:</span> {summary.remaining}
        </div>
      </CardContent>
    </Card>
  );
}