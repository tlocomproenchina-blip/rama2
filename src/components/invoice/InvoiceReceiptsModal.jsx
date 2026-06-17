import React, { useState, useEffect } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Boxes, Package as PackageIcon, ShieldCheck, FileText } from 'lucide-react';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export default function InvoiceReceiptsModal({ invoice, open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [receipts, setReceipts] = useState([]);

  useEffect(() => {
    if (!open || !invoice) return;
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const data = await base44.entities.CbmIngreso.filter({ billed_invoice_id: invoice.id }, '-fecha', 200);
        if (active) setReceipts(data || []);
      } catch {
        if (active) setReceipts([]);
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [open, invoice]);

  const totalCbm = receipts.reduce((s, r) => s + num(r.cbm), 0);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Recibos de la factura {invoice?.invoice_number}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : receipts.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            Esta factura no tiene recibos de CBM vinculados.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3 text-sm text-slate-600">
              <span className="font-medium">{receipts.length} recibo(s)</span>
              <span className="inline-flex items-center gap-1 text-blue-700 font-semibold">
                <Boxes className="h-4 w-4" /> {totalCbm.toFixed(4)} CBM total
              </span>
            </div>
            {receipts.map((r) => {
              const trackings = r.tracking_numbers || [];
              return (
                <div key={r.id} className="rounded-lg border border-slate-200 p-4 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-blue-700">{num(r.cbm).toFixed(4)} CBM</span>
                    {(r.invoice_number || r.descripcion) && (
                      <span className="text-xs text-indigo-600 font-medium">📄 {r.invoice_number || r.descripcion}</span>
                    )}
                    {r.disponible_entrega && (
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">✓ Disponible para entrega</span>
                    )}
                  </div>
                  {trackings.length > 0 && (
                    <p className="text-xs text-slate-500 break-all">{trackings.join(', ')}</p>
                  )}
                  <div className="flex flex-wrap gap-3 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1"><PackageIcon className="h-3 w-3" /> {trackings.length} paquete(s)</span>
                    {num(r.fob_total) > 0 && (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <ShieldCheck className="h-3 w-3" /> FOB ${num(r.fob_total).toFixed(2)}
                      </span>
                    )}
                    {r.fecha && (
                      <span>{new Date(r.fecha).toLocaleDateString('es-VE')}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}