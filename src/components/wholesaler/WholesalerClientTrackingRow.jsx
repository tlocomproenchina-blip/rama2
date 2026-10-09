import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RotateCw } from 'lucide-react';
import useWholesalerShipmentResend from '@/hooks/useWholesalerShipmentResend';
import { photosText, shipmentState, shipmentWhen } from '@/lib/wholesalerShipmentStatus';

// Un tracking del cliente con el estado de su aviso al mayorista y el reintento
// cuando quedó pendiente o fallido.
export default function WholesalerClientTrackingRow({ tracking, onResent }) {
  const state = shipmentState(tracking.estado);
  const { resend, sendingId } = useWholesalerShipmentResend(onResent);
  const sending = sendingId === tracking.log_id;
  const when = tracking.notified_date
    ? `enviado el ${shipmentWhen(tracking.notified_date)}`
    : shipmentWhen(tracking.last_date);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-2 py-1.5">
      <Badge className={state.tone}>{state.label}</Badge>
      <span className="font-mono text-xs text-foreground">{tracking.tracking_number || 'sin tracking'}</span>
      {Number(tracking.fotos_count) > 0 && (
        <span className="text-xs text-muted-foreground">{photosText(tracking.fotos_count)}</span>
      )}
      <span className="text-xs text-muted-foreground">{when}</span>
      {Number(tracking.attempts) > 0 && (
        <span className="text-xs text-muted-foreground">{tracking.attempts} intento(s)</span>
      )}
      {tracking.can_resend && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => resend(tracking.log_id)}
          disabled={sending}
          className="ml-auto gap-1.5"
        >
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
          Reintentar
        </Button>
      )}
    </div>
  );
}