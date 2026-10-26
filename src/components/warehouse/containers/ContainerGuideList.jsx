import React from 'react';
import { Truck } from 'lucide-react';

const shortDate = (value) => (value ? new Date(value).toLocaleDateString('es-VE') : '—');

// Guías de despacho donde salió la carga de este contenedor.
export default function ContainerGuideList({ guides = [] }) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <Truck className="h-3.5 w-3.5" /> Guías de despacho
      </p>
      {!guides.length && <p className="text-xs text-slate-500">Sin guías de despacho.</p>}
      {guides.map((guide) => (
        <div key={guide.id} className="rounded-lg border border-slate-200 px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-800">{guide.guide_number}</span>
            <span className="text-[11px] text-slate-500">{shortDate(guide.emitted_date)}</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-600">
            {guide.dispatch_status === 'entregada' ? 'Entregada' : 'Emitida'}
            {guide.dispatched_on ? ' · despachada por regla de sábado' : ''}
            {guide.lines.length ? ` · ${guide.lines.length} línea(s)` : ''}
          </p>
          {!!guide.lines.length && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {guide.lines.map((line, index) => (
                <span
                  key={`${guide.id}-${line.label_code}-${index}`}
                  className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700"
                >
                  {line.is_caja ? 'Caja ' : 'Bulto '}
                  {line.label_code || line.order_number}
                  {line.is_caja && line.caja_number ? ` (${line.caja_number}/${line.caja_total})` : ''}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}