import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Boxes, Package, Truck } from 'lucide-react';
import { format } from 'date-fns';

const SOURCE_LABELS = {
  periodo_pagos: 'Desde el período de pagos',
  escaneo: 'Desde el escaneo',
  lote_etiquetas: 'Al imprimir etiquetas',
  manual: 'Emitida a mano',
};

export default function DispatchGuideMiniCard({ guide }) {
  const delivered = guide.dispatch_status === 'entregada';
  const totals = guide.totals || {};
  const dispatchOrders = guide.dispatch_orders || [];

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-mono text-sm font-medium text-slate-800">{guide.guide_number}</p>
            <Badge
              variant="outline"
              className={`text-xs ${delivered
                ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                : 'bg-amber-100 text-amber-700 border-amber-200'}`}
            >
              {delivered ? 'Entregada' : 'Emitida'}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            {guide.emitted_date && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(guide.emitted_date), 'dd/MM/yyyy')}
              </span>
            )}
            {SOURCE_LABELS[guide.source] && <span>{SOURCE_LABELS[guide.source]}</span>}
          </div>
        </div>

        <div className="flex items-center gap-4 mt-2 text-xs text-slate-600 flex-wrap">
          <span className="flex items-center gap-1">
            <Boxes className="h-3 w-3 text-slate-400" />
            {totals.bultos || 0} bultos
          </span>
          {Number(totals.cajas) > 0 && (
            <span className="flex items-center gap-1">
              <Package className="h-3 w-3 text-slate-400" />
              {totals.cajas} cajas consolidadas
            </span>
          )}
          {Number(totals.cbm) > 0 && <span>{Number(totals.cbm).toFixed(3)} CBM</span>}
        </div>

        {dispatchOrders.length > 0 && (
          <p className="mt-2 text-xs text-slate-500 flex items-center gap-1 flex-wrap">
            <Truck className="h-3 w-3 text-slate-400" />
            {dispatchOrders.map((o) => o.order_number).filter(Boolean).join(' · ')}
          </p>
        )}

        {delivered && (guide.delivered_date || guide.received_by) && (
          <p className="mt-2 text-xs text-emerald-700">
            Entregada{guide.delivered_date ? ` el ${format(new Date(guide.delivered_date), 'dd/MM/yyyy')}` : ''}
            {guide.received_by ? ` · Recibió: ${guide.received_by}` : ''}
          </p>
        )}

        {guide.delivery_notes && (
          <p className="mt-1 text-xs text-slate-500">{guide.delivery_notes}</p>
        )}
      </CardContent>
    </Card>
  );
}