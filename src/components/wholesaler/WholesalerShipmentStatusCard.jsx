import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RotateCw } from 'lucide-react';
import WholesalerPhotoStrip from './WholesalerPhotoStrip';
import useWholesalerShipmentResend from '@/hooks/useWholesalerShipmentResend';
import { photosText, shipmentState, shipmentWhen } from '@/lib/wholesalerShipmentStatus';

// Estado de una carga frente al mayorista: si su aviso salió, con qué tracking y
// fotos, en qué intento, y su reenvío cuando quedó pendiente o fallido.
export default function WholesalerShipmentStatusCard({ status, onResent }) {
  const state = shipmentState(status?.estado);
  const { resend, sendingId } = useWholesalerShipmentResend(onResent);
  const sending = sendingId === status?.id;

  if (!status) return null;

  return (
    <div className="space-y-2 rounded-xl border border-border/70 bg-card p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={state.tone}>{state.label}</Badge>
        <span className="font-mono text-xs text-foreground">{status.tracking_number || 'sin tracking'}</span>
        {status.wholesaler_name && <span className="text-xs text-muted-foreground">{status.wholesaler_name}</span>}
        {status.notified_date && (
          <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">Enviado: {shipmentWhen(status.notified_date)}</span>
        )}
      </div>

      <p className="text-sm text-foreground">{status.mensaje}</p>

      <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
        <p>Cliente: {status.client_email || '—'}</p>
        <p>Shipping Mark: {status.shipping_mark || '—'}</p>
        <p>
          Paquete: {status.package_status || '—'}
          {status.package_orphan ? ' · huérfano' : ''}
        </p>
        <p>Intentos de envío: {status.attempts || 0}</p>
      </div>

      <WholesalerPhotoStrip fotos={status.fotos} />

      {status.estado !== 'enviado' && status.aviso_configurado === false && (
        <p className="text-xs text-amber-600">
          El aviso automático de ese mayorista está desactivado o le falta la dirección de su app: mientras siga así, el envío no puede salir.
        </p>
      )}

      {status.can_resend && (
        <Button size="sm" onClick={() => resend(status.id)} disabled={sending} className="gap-2">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
          Reenviar al mayorista
        </Button>
      )}

      {status.history?.length > 0 && (
        <div className="space-y-1 border-t border-border/70 pt-2">
          <p className="text-xs font-semibold text-foreground">Intentos de envío ({status.history.length})</p>
          {status.history.map((attempt, index) => (
            <p key={`${attempt.date}-${index}`} className="text-xs text-muted-foreground">
              {shipmentWhen(attempt.date)} · {attempt.result === 'enviado' ? 'Enviado' : 'Fallido'} · {photosText(attempt.fotos_count)}
              {attempt.detail ? ` · ${attempt.detail}` : ''}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}