import React from 'react';
import { Badge } from '@/components/ui/badge';
import { MapPin } from 'lucide-react';
import DispatchOrderMarkBlock from '@/components/dispatch-order/DispatchOrderMarkBlock';
import { unitsLabel } from '@/lib/dispatchOrderCounts';

// Una ciudad de la orden, con sus clientes y el total de carga que el almacén debe sacar.
export default function DispatchOrderCityGroup({ city }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
          <MapPin className="h-4 w-4 text-primary" /> {city.city}
        </p>
        <Badge variant="secondary">{city.clients_count || 0} cliente(s)</Badge>
      </div>
      <div className="mt-3 space-y-3">
        {(city.marks || []).map((mark) => (
          <DispatchOrderMarkBlock key={`${mark.shipping_mark}-${mark.client_email || mark.client_name}`} mark={mark} />
        ))}
      </div>
      <p className="mt-3 border-t border-border/70 pt-2 text-sm font-semibold text-foreground">
        Total {city.city}: {unitsLabel(city.cajas, city.bultos_sueltos)}
      </p>
    </div>
  );
}