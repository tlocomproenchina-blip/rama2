import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { DELIVERY_OPTION_LABELS } from '@/lib/invoiceDeliveryChoice';

// Permite al cliente volver atrás y cambiar su elección de entrega
// mientras la factura no tenga pago ni abono registrado.
export default function DeliveryChoiceBanner({ invoice, onReverted }) {
  const [busy, setBusy] = useState(false);

  const goBack = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('chooseInvoiceDelivery', { invoice_id: invoice.id, action: 'reset' });
      onReverted(res.data.invoice);
    } catch (e) {
      toast.error(e?.response?.data?.error || 'No se pudo volver atrás. Intenta de nuevo.');
    }
    setBusy(false);
  };

  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-accent/50 px-4 py-3 text-sm">
      <span className="text-slate-700">
        Entrega elegida: <strong>{DELIVERY_OPTION_LABELS[invoice.delivery_option]}</strong>
      </span>
      <Button variant="outline" size="sm" onClick={goBack} disabled={busy}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowLeft className="mr-2 h-4 w-4" />}
        Volver atrás y cambiar
      </Button>
    </div>
  );
}