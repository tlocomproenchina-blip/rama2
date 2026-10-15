import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, LifeBuoy } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { DELIVERY_PROOF_ALERT, formatDeliveryProofDeadline } from '@/lib/deliveryProofDeadline';

// Aviso que ve el cliente cuando ya venció el plazo de 10 días para cargar la
// fecha de entrega del vendedor y su foto.
export default function DeliveryProofDeadlineAlert({ deadline, className = '' }) {
  return (
    <div className={`rounded-xl border border-amber-300 bg-amber-50 p-3 md:p-4 space-y-2 ${className}`}>
      <p className="flex items-center gap-2 text-xs md:text-sm font-semibold text-amber-900">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        Fuera de fecha para cargar la entrega
      </p>
      <p className="text-[11px] md:text-sm text-amber-900/90">{DELIVERY_PROOF_ALERT}</p>
      {deadline && (
        <p className="text-[11px] text-amber-800/80">
          Plazo vencido el {formatDeliveryProofDeadline(deadline)} (10 días desde tu pre-alerta).
        </p>
      )}
      <Link to={createPageUrl('Support')} className="inline-block">
        <Button size="sm" variant="outline" className="border-amber-400 text-amber-900 hover:bg-amber-100">
          <LifeBuoy className="h-4 w-4 mr-2" />
          Abrir ticket en Soporte
        </Button>
      </Link>
    </div>
  );
}