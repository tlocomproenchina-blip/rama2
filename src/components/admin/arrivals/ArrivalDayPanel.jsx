import React from 'react';
import { Package, TrendingUp, CalendarDays } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function formatDay(key) {
  if (!key) return '';
  const [y, m, d] = key.split('-').map(Number);
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
}

export default function ArrivalDayPanel({ selectedKey, loads }) {
  const totalCbm = loads.reduce((sum, l) => sum + (Number(l.cbm) || 0), 0);
  const totalFob = loads.reduce((sum, l) => sum + (Number(l.fob_total) || 0), 0);

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-card">
      <div className="flex items-center gap-2 mb-3">
        <CalendarDays className="h-5 w-5 text-primary" />
        <h3 className="text-base font-semibold text-slate-800">
          {selectedKey ? formatDay(selectedKey) : 'Selecciona un día'}
        </h3>
      </div>

      {!selectedKey && (
        <p className="text-sm text-slate-500">Toca un día con carga en el calendario para ver el detalle de los paquetes que llegan ese día.</p>
      )}

      {selectedKey && loads.length === 0 && (
        <p className="text-sm text-slate-500">No hay carga con llegada estimada para este día.</p>
      )}

      {selectedKey && loads.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="rounded-xl bg-slate-50 p-2 text-center">
              <p className="text-lg font-bold text-slate-800">{loads.length}</p>
              <p className="text-[11px] text-slate-500">Cargas</p>
            </div>
            <div className="rounded-xl bg-sky-50 p-2 text-center">
              <p className="text-lg font-bold text-sky-700">{totalCbm.toFixed(2)}</p>
              <p className="text-[11px] text-slate-500">CBM</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-2 text-center">
              <p className="text-lg font-bold text-emerald-700">${totalFob.toFixed(0)}</p>
              <p className="text-[11px] text-slate-500">FOB</p>
            </div>
          </div>

          <div className="space-y-2 max-h-[480px] overflow-y-auto">
            {loads.map((load) => (
              <div key={load.id} className="rounded-xl border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{load.client_name || load.client_email || 'Sin cliente'}</p>
                    {load.shipping_mark && (
                      <p className="text-xs font-mono text-slate-500 truncate">{load.shipping_mark}</p>
                    )}
                  </div>
                  {load.disponible_entrega && (
                    <Badge className="bg-emerald-100 text-emerald-700 shrink-0">Disponible</Badge>
                  )}
                </div>
                {load.descripcion && (
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{load.descripcion}</p>
                )}
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-600">
                  <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> {(Number(load.cbm) || 0).toFixed(3)} CBM</span>
                  {load.fob_total > 0 && <span>FOB ${Number(load.fob_total).toFixed(0)}</span>}
                  {Array.isArray(load.tracking_numbers) && load.tracking_numbers.length > 0 && (
                    <span className="flex items-center gap-1"><Package className="h-3 w-3" /> {load.tracking_numbers.length}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}