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
export default function PendingBillingBultoRow({ bulto, marking, onMark }) {
  const orders = (bulto.order_numbers || []).filter(Boolean);

  return (
    <div className="rounded-lg border border-border/70 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold text-slate-800 break-all">
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
              checked={false}
              onCheckedChange={(value) => onMark(bulto, !!value)}
              title="Marcar como ya facturado"
              aria-label="Marcar como ya facturado"
            />
          )}
          <span className="text-[10px] text-slate-500">Facturado</span>
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

      {orders.length === 0 && (
        <Badge className="mt-1.5 bg-amber-100 text-amber-700 border border-amber-200">
          Sin N° de orden asignado
        </Badge>
      )}
    </div>
  );
}