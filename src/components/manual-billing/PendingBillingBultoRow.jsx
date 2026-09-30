import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package } from 'lucide-react';

const formatDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-VE');
};

// Un bulto pendiente dentro de la tarjeta del cliente: su N° de orden/envío al frente
// y la casilla para marcarlo a mano como ya facturado (sin generar factura).
// Marcado no se oculta: el bulto se pinta en verde y la casilla permite deshacer.
export default function PendingBillingBultoRow({ bulto, marking, onMark }) {
  const orders = (bulto.order_numbers || []).filter(Boolean);
  const marked = !!bulto.billing_marked;

  return (
    <div className={`rounded-lg border p-2.5 transition-colors ${
      marked ? 'border-emerald-300 bg-emerald-50/60' : 'border-border/70'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`font-mono text-sm font-semibold break-all ${marked ? 'text-emerald-800' : 'text-slate-800'}`}>
            {orders.length > 0 ? orders.join(', ') : 'Sin N° de orden'}
          </p>
          <p className="text-[11px] text-slate-500 break-all">
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
              title={marked ? 'Quitar la marca de facturado' : 'Marcar como ya facturado'}
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
        {bulto.ve_recognized_date && (
          <>
            <span className="text-slate-400">·</span>
            <span>En almacén VE: {formatDate(bulto.ve_recognized_date)}</span>
          </>
        )}
      </div>

      {marked && (
        <Badge className="mt-1.5 bg-emerald-100 text-emerald-700 border border-emerald-200">
          Facturado{bulto.billing_marked_date ? ` · ${formatDate(bulto.billing_marked_date)}` : ''}
        </Badge>
      )}

      {orders.length === 0 && (
        <Badge className="mt-1.5 bg-amber-100 text-amber-700 border border-amber-200">
          Sin N° de orden asignado
        </Badge>
      )}
    </div>
  );
}