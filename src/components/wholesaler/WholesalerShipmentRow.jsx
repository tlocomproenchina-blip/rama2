import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, Loader2, RotateCw } from 'lucide-react';
import WholesalerPhotoStrip from './WholesalerPhotoStrip';
import useWholesalerShipmentResend from '@/hooks/useWholesalerShipmentResend';
import { photosText, shipmentState, shipmentWhen } from '@/lib/wholesalerShipmentStatus';

// Una carga avisada a la app del mayorista: su tracking, las fotos que viajaron
// con el aviso, el resultado y el reintento cuando quedó pendiente o fallido.
export default function WholesalerShipmentRow({ shipment, onResent }) {
  const [open, setOpen] = useState(false);
  const state = shipmentState(shipment.estado);
  const { resend, sendingId } = useWholesalerShipmentResend(onResent);
  const sending = sendingId === shipment.id;
  const lastDetail = shipment.history?.[0]?.detail;

  return (
    <div className="rounded-xl border border-border/70 bg-card p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={state.tone}>{state.label}</Badge>
        <span className="font-mono text-xs text-foreground">{shipment.tracking_number || 'sin tracking'}</span>
        {shipment.shipping_mark && <span className="text-xs text-muted-foreground">{shipment.shipping_mark}</span>}
        {shipment.client_email && <span className="text-xs text-muted-foreground">{shipment.client_email}</span>}
        {shipment.photo_pending && <Badge className="bg-amber-100 text-amber-700">Falta foto de recepción</Badge>}
        <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">{shipmentWhen(shipment.event_date)}</span>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        {photosText(shipment.fotos_count)} · {shipment.attempts} intento(s)
        {shipment.notified_date ? ` · enviado el ${shipmentWhen(shipment.notified_date)}` : ''}
        {lastDetail ? ` · ${lastDetail}` : ''}
      </p>

      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" onClick={() => setOpen((prev) => !prev)} className="gap-1">
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          {open ? 'Ocultar detalle' : 'Ver detalle'}
        </Button>
        {shipment.can_resend && (
          <Button size="sm" onClick={() => resend(shipment.id)} disabled={sending} className="gap-2">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
            Reenviar al mayorista
          </Button>
        )}
      </div>

      {open && (
        <div className="mt-3 space-y-2 border-t border-border/70 pt-3">
          <WholesalerPhotoStrip fotos={shipment.fotos} />
          {shipment.history?.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">Intentos de envío ({shipment.history.length})</p>
              {shipment.history.map((attempt, index) => (
                <p key={`${attempt.date}-${index}`} className="text-xs text-muted-foreground">
                  {shipmentWhen(attempt.date)} · {attempt.result === 'enviado' ? 'Enviado' : 'Fallido'} · {photosText(attempt.fotos_count)}
                  {attempt.detail ? ` · ${attempt.detail}` : ''}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}