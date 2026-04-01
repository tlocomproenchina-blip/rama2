import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, AlertTriangle } from 'lucide-react';

export default function DuplicateWhatsappList({ items = [] }) {
  if (items.length === 0) {
    return (
      <Card><CardContent className="p-8 text-center text-slate-500">No hay teléfonos duplicados</CardContent></Card>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <Card key={idx} className="border-amber-200/70">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-amber-50">
                <Phone className="h-4 w-4 text-amber-500" />
              </div>
              <div className="flex-1">
                <p className="font-mono font-semibold text-slate-800">{item.phone}</p>
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {item.count} clientes comparten este número
                </p>
              </div>
              <Badge className="bg-amber-100 text-amber-700 border-amber-200">{item.count} duplicados</Badge>
            </div>
            <div className="bg-slate-50 rounded-lg divide-y divide-slate-100">
              {item.users.map((u, i) => (
                <div key={i} className="px-3 py-2 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{u.full_name || 'Sin nombre'}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </div>
                  <p className="text-xs font-mono text-slate-400">{u.whatsapp}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}