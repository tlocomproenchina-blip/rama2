import React from 'react';
import { Badge } from '@/components/ui/badge';
import { MapPin } from 'lucide-react';
import DispatchOrderMarkBlock from '@/components/dispatch-order/DispatchOrderMarkBlock';

// Una ciudad de la orden, con sus clientes y los totales que el almacén debe sacar.
export default function DispatchOrderCityGroup({ city }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
          <MapPin className="h-4 w-4 text-primary" /> {city.city}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-800">
            {city.cajas || 0} caja(s)
          </Badge>
          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
            {city.bultos_sueltos || 0} bulto(s) suelto(s)
          </Badge>
          <Badge variant="secondary">{city.total_unidades || 0} unidad(es)</Badge>
        </div>
      </div>
      <div className="mt-3 space-y-3">
        {(city.marks || []).map((mark) => (
          <DispatchOrderMarkBlock key={`${mark.shipping_mark}-${mark.client_email || mark.client_name}`} mark={mark} />
        ))}
      </div>
    </div>
  );
}