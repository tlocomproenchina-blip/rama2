import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Hash, Package } from 'lucide-react';
import { format } from 'date-fns';

const STATUS = {
  activo: { label: 'En almacén', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  cerrado: { label: 'Cerrado', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  en_almacen_ve: { label: 'En almacén Venezuela', cls: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  despachado: { label: 'Despachado', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

export default function ClientBultoCard({ bulto }) {
  const [open, setOpen] = useState(false);
  const status = STATUS[bulto.status] || { label: bulto.status || '—', cls: 'bg-slate-100 text-slate-600 border-slate-200' };
  const trackings = bulto.trackings || [];
  const orderNumbers = bulto.order_numbers || [];
  const date = bulto.recognized_date || bulto.created_date;

  const kind = bulto.is_caja
    ? `Caja consolidada${bulto.caja_number ? ` ${bulto.caja_number}/${bulto.caja_total || '?'}` : ''}`
    : `Bulto ${bulto.bulto_number || 1}/${bulto.total_bultos || bulto.bulto_number || 1}`;

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
            <p className="font-mono text-sm font-medium text-slate-800">{bulto.label_code || 'Sin etiqueta'}</p>
            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-xs text-slate-600">{kind}</Badge>
            <Badge variant="outline" className={`text-xs ${status.cls}`}>{status.label}</Badge>
          </div>
          <span className="shrink-0 whitespace-nowrap text-xs text-slate-500">
            {bulto.package_count || 0} {(bulto.package_count || 0) === 1 ? 'paquete' : 'paquetes'}
          </span>
        </button>

        {open && (
          <div className="space-y-3 border-t border-slate-100 px-3 pb-3 pt-3 md:px-4 md:pb-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-400">N° de contenedor</p>
                <p className="break-words text-slate-700">{orderNumbers.length ? orderNumbers.join(' · ') : '—'}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-400">CBM</p>
                <p className="text-slate-700">{bulto.cbm ? `${Number(bulto.cbm).toFixed(3)} CBM` : '—'}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Fecha</p>
                <p className="text-slate-700">{date ? format(new Date(date), 'dd/MM/yyyy') : '—'}</p>
              </div>
            </div>

            <div>
              <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-700">
                <Hash className="h-3 w-3 text-slate-400" />
                Contenido ({bulto.package_count || trackings.length})
              </p>
              {trackings.length > 0 ? (
                <ul className="space-y-1">
                  {trackings.map((t) => (
                    <li key={t} className="flex items-center gap-2 rounded-md bg-slate-50 px-2 py-1">
                      <Package className="h-3 w-3 shrink-0 text-slate-400" />
                      <span className="break-all font-mono text-xs text-slate-700">{t}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400">Tu carga está en almacén, el detalle se completa al escanearla.</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}