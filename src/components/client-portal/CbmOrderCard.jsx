import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const fmtDate = (d, withTime = false) => {
  try {
    const date = withTime ? new Date(d) : new Date(d + 'T12:00:00');
    return format(date, withTime ? 'dd MMM yyyy · HH:mm' : 'dd MMM yyyy', { locale: es });
  } catch {
    return '—';
  }
};

function Step({ done, label, date, isFirst, isLast }) {
  return (
    <div className="flex-1 flex flex-col items-center text-center min-w-0">
      <div className="flex items-center w-full">
        <div className={`flex-1 h-0.5 ${isFirst ? 'invisible' : done ? 'bg-emerald-400' : 'bg-slate-200'}`} />
        {done ? (
          <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
        ) : (
          <Circle className="h-6 w-6 text-slate-300 shrink-0" />
        )}
        <div className={`flex-1 h-0.5 ${isLast ? 'invisible' : done ? 'bg-emerald-400' : 'bg-slate-200'}`} />
      </div>
      <p className={`mt-1.5 text-[11px] font-semibold leading-tight ${done ? 'text-emerald-700' : 'text-slate-400'}`}>{label}</p>
      {date && <p className="text-[10px] text-slate-500">{date}</p>}
    </div>
  );
}

export default function CbmOrderCard({ item, paid, deliveredDate }) {
  const [showTrackings, setShowTrackings] = useState(false);
  const trackings = item.tracking_numbers || [];
  const salio = !!item.fecha_salida;
  const entregado = !!deliveredDate;
  const disponible = !!item.disponible_entrega || entregado;

  return (
    <div className="rounded-xl border border-border/70 bg-white p-4 space-y-3 shadow-sm">
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-blue-700 text-sm">{Number(item.cbm).toFixed(5)} CBM</span>
          {item.invoice_number && (
            <Badge variant="outline" className="text-[10px]">Orden N: {item.invoice_number}</Badge>
          )}
          {paid && (
            <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold">PAGADA</Badge>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground">
          {item.fecha ? fmtDate(item.fecha, true) : ''}
        </span>
      </div>

      {/* Línea de estado */}
      <div className="flex items-start pt-1">
        <Step done isFirst label="Recibido en China" date={item.fecha ? fmtDate(item.fecha, false) : null} />
        <Step done={salio} label="En camino a Venezuela" date={item.fecha_salida ? `Salió: ${fmtDate(item.fecha_salida)}` : 'Pendiente de salida'} />
        <Step
          done={disponible}
          label={disponible ? 'Disponible para entrega' : 'Llegada estimada'}
          date={disponible ? '¡Ya puedes recibirla!' : (item.fecha_estimada_llegada ? fmtDate(item.fecha_estimada_llegada) : null)}
        />
        <Step
          done={entregado}
          label="Entregado"
          date={entregado ? (typeof deliveredDate === 'string' ? fmtDate(deliveredDate, true) : '✓') : null}
          isLast
        />
      </div>

      {item.descripcion && <p className="text-xs text-slate-500">{item.descripcion}</p>}

      {/* Trackings colapsados */}
      {trackings.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowTrackings((v) => !v)}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            {showTrackings ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {trackings.length} tracking{trackings.length === 1 ? '' : 's'} en esta orden
          </button>
          {showTrackings && (
            <div className="flex flex-wrap gap-1 mt-2">
              {trackings.map((t) => (
                <span key={t} className="inline-block text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-mono break-all">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}