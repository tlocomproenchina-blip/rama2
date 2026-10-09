import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import WholesalerShipmentRow from './WholesalerShipmentRow';

export default function WholesalerShipmentHistory({ shipments = [], loading, onResent }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    );
  }

  if (!shipments.length) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Todavía no se ha avisado ninguna carga a las apps de los mayoristas en este período.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {shipments.map((shipment) => (
        <WholesalerShipmentRow key={shipment.id} shipment={shipment} onResent={onResent} />
      ))}
    </div>
  );
}