import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Boxes, Package, Truck, Download, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { generateDispatchGuidePdf } from '@/lib/dispatchGuidePdf';
import DispatchGuideDetail from './DispatchGuideDetail';

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
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await generateDispatchGuidePdf({
        clients: Array.isArray(guide.clients) ? guide.clients : [],
        mode: 'save',
        guideNumber: guide.guide_number,
        emittedAt: guide.emitted_date,
        notes: guide.delivery_notes || '',
      });
    } catch (_) {
      toast.error('No se pudo generar el PDF de la guía');
    }
    setDownloading(false);
  };

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

        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {open ? 'Ocultar detalle' : 'Ver detalle'}
          </Button>
          <Button size="sm" variant="outline" onClick={handleDownload} disabled={downloading}>
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Descargar PDF
          </Button>
        </div>

        {open && (
          <div className="mt-3">
            <DispatchGuideDetail guide={guide} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}