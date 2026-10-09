import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

// Reintento del aviso de una carga al mayorista: se vuelve a enviar el tracking
// con las fotos y el envío queda actualizado en el historial.
export default function useWholesalerShipmentResend(onSent) {
  const [sendingId, setSendingId] = useState(null);

  const resend = async (logId) => {
    if (!logId) return;
    setSendingId(logId);
    try {
      const res = await base44.functions.invoke('resendWholesalerShipment', { log_id: logId });
      const data = res?.data || {};
      if (data.enviado) toast.success(data.mensaje || 'Aviso reenviado al mayorista.');
      else toast.error(data.mensaje || data.error || 'El aviso no se pudo enviar.');
      await onSent?.();
    } catch (err) {
      toast.error(err?.message || 'No se pudo reenviar el aviso al mayorista.');
    } finally {
      setSendingId(null);
    }
  };

  return { resend, sendingId };
}