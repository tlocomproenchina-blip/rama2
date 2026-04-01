import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, AlertTriangle } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';

export default function DuplicateTrackingList({ items = [] }) {
  if (items.length === 0) {
    return (
      <Card><CardContent className="p-8 text-center text-slate-500">No hay trackings duplicados</CardContent></Card>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <Card key={idx} className="border-orange-200/70">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-orange-50">
                <Package className="h-4 w-4 text-orange-500" />
              </div>
              <div className="flex-1">
                <p className="font-mono font-semibold text-slate-800">{item.tracking}</p>
                <p className="text-xs text-orange-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {item.count} paquetes con el mismo tracking
                </p>
              </div>
              <Badge className="bg-orange-100 text-orange-700 border-orange-200">{item.count} duplicados</Badge>
            </div>
            <div className="bg-slate-50 rounded-lg divide-y divide-slate-100">
              {item.packages.map((p, i) => (
                <div key={i} className="px-3 py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700 truncate">{p.client_email}</p>
                    <p className="text-xs text-slate-400">{p.shipping_mark || 'Sin SM'} • {new Date(p.created_date).toLocaleDateString('es-VE')}</p>
                  </div>
                  <StatusBadge status={p.status} size="sm" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}