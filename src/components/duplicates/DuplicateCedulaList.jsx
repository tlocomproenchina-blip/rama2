import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, AlertTriangle } from 'lucide-react';

export default function DuplicateCedulaList({ items = [] }) {
  if (items.length === 0) {
    return (
      <Card><CardContent className="p-8 text-center text-slate-500">No hay cédulas duplicadas</CardContent></Card>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <Card key={idx} className="border-red-200/70">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-red-50">
                <CreditCard className="h-4 w-4 text-red-500" />
              </div>
              <div className="flex-1">
                <p className="font-mono font-semibold text-slate-800">{item.cedula}</p>
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {item.count} clientes comparten esta cédula
                </p>
              </div>
              <Badge variant="destructive">{item.count} duplicados</Badge>
            </div>
            <div className="bg-slate-50 rounded-lg divide-y divide-slate-100">
              {item.users.map((u, i) => (
                <div key={i} className="px-3 py-2 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{u.full_name || 'Sin nombre'}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </div>
                  <p className="text-xs font-mono text-slate-400">{u.cedula}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}