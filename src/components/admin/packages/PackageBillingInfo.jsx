import React, { useEffect, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Loader2, ReceiptText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function PackageBillingInfo({ tracking }) {
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setInfo(null);
      const cleaned = (tracking || '').trim();
      if (!cleaned) { setLoading(false); return; }
      try {
        const ingresos = await base44.entities.CbmIngreso.filter({ tracking_numbers: cleaned }, '-fecha', 5);
        const ingreso = ingresos?.[0];
        if (!ingreso) { if (active) setLoading(false); return; }

        let invoiceNumber = ingreso.invoice_number || null;
        if (!invoiceNumber && ingreso.billed_invoice_id) {
          try {
            const inv = await base44.entities.Invoice.get(ingreso.billed_invoice_id);
            invoiceNumber = inv?.invoice_number || null;
          } catch (_) {}
        }
        if (active) {
          setInfo({
            invoiceNumber,
            billed: ingreso.billed,
            fecha: ingreso.fecha,
            descripcion: ingreso.descripcion,
          });
        }
      } catch (_) {}
      if (active) setLoading(false);
    };
    load();
    return () => { active = false; };
  }, [tracking]);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1">
        <ReceiptText className="h-4 w-4 text-blue-600" /> Facturación
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="h-3 w-3 animate-spin" /> Buscando recibo asociado...
        </div>
      ) : !info ? (
        <p className="text-xs text-slate-500">Este tracking aún no está asociado a ningún recibo o factura.</p>
      ) : (
        <div className="space-y-1 text-sm">
          <p className="text-slate-700">
            Recibo / Factura: {info.invoiceNumber
              ? <span className="font-mono font-semibold text-blue-700 break-all">{info.invoiceNumber}</span>
              : <span className="text-slate-500">registrado en CBM sin número asignado</span>}
          </p>
          <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500">
            {info.fecha && <span>Ingreso CBM: {new Date(info.fecha).toLocaleDateString('es-VE')}</span>}
            {info.billed
              ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200" variant="outline">Facturado</Badge>
              : <Badge className="bg-amber-100 text-amber-700 border-amber-200" variant="outline">Pendiente de facturar</Badge>}
          </div>
        </div>
      )}
    </div>
  );
}