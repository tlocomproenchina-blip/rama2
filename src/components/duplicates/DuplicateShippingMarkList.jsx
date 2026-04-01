import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tag, AlertTriangle, CheckCircle, Calendar, Package } from 'lucide-react';

export default function DuplicateShippingMarkList({ items = [] }) {
  if (!items.length) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-6 text-center">
          <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
          <p className="text-green-700 font-medium">No hay Shipping Marks duplicados</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <Card key={i} className="border-purple-200/70">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-purple-600" />
                <span className="font-mono font-bold text-purple-800">{item.shipping_mark}</span>
              </div>
              <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                {item.count} duplicados
              </Badge>
            </div>
            <div className="flex items-center gap-1 text-amber-600 text-xs mb-3">
              <AlertTriangle className="h-3 w-3" />
              <span>{item.count} clientes comparten este Shipping Mark</span>
            </div>
            <div className="space-y-2">
              {item.users.map((u, j) => (
                <div key={j} className="flex items-center justify-between p-2 bg-purple-50/50 rounded-lg text-sm gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800">{u.full_name || '—'}</p>
                    <p className="text-xs text-slate-500 truncate">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500 flex-shrink-0">
                    <div className="flex items-center gap-1" title="Fecha de registro">
                      <Calendar className="h-3 w-3" />
                      {u.created_date ? new Date(u.created_date).toLocaleDateString('es-VE') : '—'}
                    </div>
                    <div className="flex items-center gap-1" title="Trackings registrados">
                      <Package className="h-3 w-3" />
                      {u.package_count ?? 0}
                    </div>
                    <div className="text-right">
                      <p>{u.cedula || '—'}</p>
                      <p>{u.whatsapp || '—'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}