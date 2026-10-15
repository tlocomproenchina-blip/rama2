import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Boxes, Calendar, ChevronDown, ChevronRight, Package } from 'lucide-react';
import { format } from 'date-fns';

export default function ClientGuideCard({ guide }) {
  const [open, setOpen] = useState(false);
  const delivered = guide.dispatch_status === 'entregada';
  const totals = guide.totals || {};
  const bultos = guide.bultos || [];

  return (
    <Card className="border border-border/70 bg-card/95 shadow-card">
      <CardContent className="p-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 p-3 text-left md:p-4"
        >
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {open ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />}
            <p className="font-mono text-sm font-medium text-slate-800">{guide.guide_number}</p>
            <Badge
              variant="outline"
              className={`text-xs ${delivered ? 'border-emerald-200 bg-emerald-100 text-emerald-700' : 'border-amber-200 bg-amber-100 text-amber-700'}`}
            >
              {delivered ? 'Entregada' : 'Emitida'}
            </Badge>
          </div>
          <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-xs text-slate-500">
            <Calendar className="h-3 w-3" />
            {guide.emitted_date ? format(new Date(guide.emitted_date), 'dd/MM/yyyy') : '—'}
          </span>
        </button>

        {open && (
          <div className="space-y-3 border-t border-slate-100 px-3 pb-3 pt-3 md:px-4 md:pb-4">
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
              <span className="flex items-center gap-1">
                <Boxes className="h-3 w-3 text-slate-400" />
                {totals.bultos || bultos.length} bultos
              </span>
              {Number(totals.cajas) > 0 && (
                <span className="flex items-center gap-1">
                  <Package className="h-3 w-3 text-slate-400" />
                  {totals.cajas} cajas consolidadas
                </span>
              )}
              {Number(totals.cbm) > 0 && <span>{Number(totals.cbm).toFixed(3)} CBM</span>}
            </div>

            {bultos.length > 0 && (
              <ul className="space-y-1">
                {bultos.map((b, i) => (
                  <li key={`${b.label_code}-${i}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-2 py-1">
                    <span className="font-mono text-xs text-slate-700 break-all">
                      {b.label_code || 'Carga sin etiqueta'}
                      {b.is_caja && b.caja_number ? ` · Caja ${b.caja_number}/${b.caja_total || '?'}` : ''}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {b.package_count || 0} {(b.package_count || 0) === 1 ? 'paquete' : 'paquetes'}
                      {b.cbm ? ` · ${Number(b.cbm).toFixed(3)} CBM` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {delivered && (guide.delivered_date || guide.received_by) && (
              <p className="text-xs text-emerald-700">
                Entregada{guide.delivered_date ? ` el ${format(new Date(guide.delivered_date), 'dd/MM/yyyy')}` : ''}
                {guide.received_by ? ` · Recibió: ${guide.received_by}` : ''}
              </p>
            )}

            {guide.delivery_notes && <p className="text-xs text-slate-500">{guide.delivery_notes}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}