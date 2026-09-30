import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package } from 'lucide-react';

const fmtDate = (v) => {
  if (!v) return null;
  const d = new Date(String(v).includes('T') ? v : `${v}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('es-VE');
};

// Un bulto dentro de la pestaña de su N° de orden: su código, su CBM y su conteo,
// con la casilla para marcarlo como ya facturado. Marcado se conserva en verde,
// agrupado abajo, y la misma casilla lo devuelve a su pestaña.
export default function PendingBillingBultoRow({ bulto, marking, onMark }) {
  const marked = !!bulto.billing_marked;
  const markedDate = fmtDate(bulto.billing_marked_date);
  const veDate = fmtDate(bulto.ve_recognized_date);

  return (
    <div className={`rounded-lg border p-2.5 transition-colors ${
      marked ? 'border-emerald-300 bg-emerald-50/60' : 'border-border/70 bg-card'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`font-mono text-sm font-semibold break-all ${marked ? 'text-emerald-800' : 'text-slate-800'}`}>
            Bulto {bulto.label}{bulto.bulto_number ? ` · #${bulto.bulto_number}` : ''}
          </p>
        </div>
        <div className="shrink-0 flex flex-col items-center gap-0.5">
          {marking ? (
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          ) : (
            <Checkbox
              checked={marked}
              onCheckedChange={(value) => onMark(bulto, !!value)}
              title={marked ? 'Quitar la marca: el bulto vuelve a su N° de orden' : 'Marcar como ya facturado'}
              aria-label="Marcar como ya facturado"
              className={marked ? 'border-emerald-600 data-[state=checked]:bg-emerald-600 data-[state=checked]:text-white' : ''}
            />
          )}
          <span className={`text-[10px] ${marked ? 'font-medium text-emerald-700' : 'text-slate-500'}`}>Facturado</span>
        </div>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-600">
        <span className="inline-flex items-center gap-1">
          <Package className="h-3 w-3" /> {Number(bulto.cbm || 0).toFixed(4)} CBM
        </span>
        <span className="text-slate-400">·</span>
        <span>{bulto.package_count || 0} paquete(s)</span>
        {veDate && (
          <>
            <span className="text-slate-400">·</span>
            <span>En almacén VE: {veDate}</span>
          </>
        )}
      </div>

      {marked && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200">
            Facturado{markedDate ? ` · ${markedDate}` : ''}
          </Badge>
          {bulto.billing_marked_by && (
            <span className="text-[10px] text-emerald-800/80">por {bulto.billing_marked_by}</span>
          )}
        </div>
      )}
    </div>
  );
}