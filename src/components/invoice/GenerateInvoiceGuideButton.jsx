import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileOutput, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/components/api/ApiQueueManager';

// Botón "Generar guía de despacho": emite una guía nueva con todos los bultos de
// la factura. Una clave por pulsación evita duplicarla si la solicitud se reintenta.
export default function GenerateInvoiceGuideButton({ invoice, className = '', size = 'sm' }) {
  const [working, setWorking] = useState(false);

  const handleClick = async (e) => {
    e?.stopPropagation?.();
    setWorking(true);
    const res = await base44.functions.invoke(
      'generateInvoiceDispatchGuide',
      { invoice_id: invoice.id, mode: 'manual', request_key: crypto.randomUUID() },
      { opType: 'write', priority: 'HIGH' }
    ).catch((error) => ({ data: { error: error?.response?.data?.error || error?.message } }));
    const data = res?.data || {};
    setWorking(false);

    if (data.guide) {
      toast.success(`Guía ${data.guide.guide_number} generada con ${Number(data.guide.totals?.bultos) || 0} bulto(s)`);
      if (data.warning) toast.warning(data.warning, { duration: 10000 });
    } else if (data.empty) {
      toast.warning('Esta factura no tiene bultos asociados: no se generó la guía');
    } else {
      toast.error(data.error || 'No se pudo generar la guía de despacho');
    }
  };

  return (
    <Button variant="outline" size={size} onClick={handleClick} disabled={working} className={`justify-start text-emerald-700 hover:bg-emerald-50 ${className}`}>
      {working ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileOutput className="h-4 w-4 mr-1" />}
      {working ? 'Generando...' : 'Generar guía de despacho'}
    </Button>
  );
}