import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users } from 'lucide-react';

export default function CbmClientSummary({ clientTotals, totalCbm, monthLabel }) {
  if (!clientTotals || clientTotals.length === 0) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="p-12 text-center">
          <Users className="h-16 w-16 mx-auto mb-4 text-slate-300" />
          <h3 className="text-lg font-semibold text-slate-700">Sin datos por cliente</h3>
          <p className="text-slate-500 mt-1">No hay registros de CBM para este mes</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-600">{clientTotals.length} cliente(s) con CBM en <span className="capitalize">{monthLabel}</span></p>
        <Badge className="bg-blue-100 text-blue-800">{totalCbm.toFixed(5)} CBM total</Badge>
      </div>

      {clientTotals.map((client, idx) => {
        const pct = totalCbm > 0 ? (client.cbm / totalCbm) * 100 : 0;
        return (
          <Card key={client.email || idx} className="border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                    <Users className="h-4 w-4 text-blue-700" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-slate-800 truncate">{client.name}</p>
                    {client.mark && <p className="text-xs text-slate-500 font-mono">{client.mark}</p>}
                    {client.email && client.email !== '__sin_cliente__' && (
                      <p className="text-xs text-slate-400">{client.email}</p>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-bold text-blue-700">{client.cbm.toFixed(5)}</p>
                  <p className="text-xs text-muted-foreground">{client.count} registro(s)</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Progress value={pct} className="h-2 flex-1" />
                <span className="text-xs font-medium text-slate-600 w-12 text-right">{pct.toFixed(1)}%</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}