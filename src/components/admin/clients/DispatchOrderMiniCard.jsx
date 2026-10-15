import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Package, Boxes } from 'lucide-react';
import { format } from 'date-fns';

const ORDER_STATUS = {
  emitida: { label: 'Emitida', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  despachado: { label: 'Despachado', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  cancelada: { label: 'Cancelada', cls: 'bg-rose-100 text-rose-700 border-rose-200' },
};

export default function DispatchOrderMiniCard({ order }) {
  const status = ORDER_STATUS[order.status] || { label: order.status || '—', cls: 'bg-slate-100 text-slate-600 border-slate-200' };
  const items = order.items || [];
  const bultoLabels = [...new Set(items.map((i) => i.bulto_label_code).filter(Boolean))];
  const totalBultos = bultoLabels.length || (order.bulto_label_code ? 1 : 0);
  const packages = items.length;

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-mono text-sm font-medium text-slate-800">{order.order_number}</p>
            <Badge variant="outline" className={`${status.cls} text-xs`}>{status.label}</Badge>
          </div>
          {order.dispatched_date && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Calendar className="h-3 w-3" />
              {format(new Date(order.dispatched_date), 'dd/MM/yyyy')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 mt-2 text-xs text-slate-600 flex-wrap">
          <span className="flex items-center gap-1">
            <Boxes className="h-3 w-3 text-slate-400" />
            {totalBultos} {totalBultos === 1 ? 'bulto' : 'bultos'}
          </span>
          <span className="flex items-center gap-1">
            <Package className="h-3 w-3 text-slate-400" />
            {packages} {packages === 1 ? 'paquete' : 'paquetes'}
          </span>
          {order.dispatched_confirmed_date && (
            <span className="text-emerald-700">
              Confirmada el {format(new Date(order.dispatched_confirmed_date), 'dd/MM/yyyy HH:mm')}
            </span>
          )}
        </div>

        {bultoLabels.length > 0 && (
          <p className="mt-2 text-xs text-slate-500 font-mono break-words">{bultoLabels.join(' · ')}</p>
        )}
      </CardContent>
    </Card>
  );
}