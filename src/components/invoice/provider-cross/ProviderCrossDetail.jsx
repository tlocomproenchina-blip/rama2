import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { openImageViewer } from '@/components/common/GlobalImageViewer';
import { money } from '@/lib/numbers';
import { FileText, Receipt } from 'lucide-react';

export default function ProviderCrossDetail({ row, onClose }) {
  if (!row) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Contenedor {row.container} · {row.client_name || row.client_email}</DialogTitle></DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="flex items-center justify-between rounded-xl bg-muted p-3">
            <div><p className="text-xs text-muted-foreground">Costo total</p><p className="font-bold">{money(row.total)}</p></div>
            {row.status === 'pagada' || row.balance <= 0
              ? <span className="rounded-full bg-success-bg px-3 py-1 text-xs font-semibold text-success">Pagado</span>
              : <span className="rounded-full bg-warning-bg px-3 py-1 text-xs font-semibold text-warning">Pendiente</span>}
          </div>
          {row.invoice_file_url ? (
            <Button variant="outline" className="w-full" onClick={() => openImageViewer(row.invoice_file_url, `Factura proveedor ${row.container}`)}>
              <FileText /> Ver factura del proveedor
            </Button>
          ) : <p className="text-xs text-muted-foreground">Sin imagen de factura del proveedor.</p>}
          <div>
            <p className="mb-2 font-semibold">Comprobantes de pago</p>
            {row.payments.length === 0 && <p className="text-xs text-muted-foreground">No hay pagos registrados.</p>}
            {row.payments.map((p, i) => (
              <div key={i} className="flex items-center justify-between border-b py-2">
                <span>{money(p.amount)} · {p.date ? String(p.date).slice(0, 10) : '—'}</span>
                {p.proof_url ? (
                  <Button size="sm" variant="ghost" onClick={() => openImageViewer(p.proof_url, 'Comprobante de pago')}><Receipt /> Ver</Button>
                ) : <span className="text-xs text-muted-foreground">Sin comprobante</span>}
              </div>
            ))}
          </div>
          <div>
            <p className="mb-1 font-semibold">Facturas del cliente</p>
            {row.client_invoices.length === 0
              ? <p className="text-xs text-muted-foreground">Sin factura de cliente con este contenedor.</p>
              : row.client_invoices.map((i) => <p key={i.id}>{i.invoice_number} · {money(i.total)} · {i.status}</p>)}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}