import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ClipboardList, Printer, Download, RefreshCw, Loader2, PackageOpen } from 'lucide-react';
import { toast } from 'sonner';
import { generateWarehouseOrder } from '@/lib/warehouseOrder';
import { generateWarehouseOrderPdf } from '@/lib/warehouseOrderPdf';

const fmtDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('es-VE');
};

const bultoTag = (bulto) => {
  const caja = bulto.is_caja && bulto.caja_number ? `[${bulto.caja_number}/${bulto.caja_total || '?'}] ` : '';
  return `${caja}${bulto.label_code || '—'}`;
};

// Orden de almacén que queda guardada dentro de la factura pagada: se ve, se
// imprime o se descarga en PDF, y se puede regenerar si quedó vieja.
export default function WarehouseOrderModal({ open, onClose, invoice, appName, onGenerated }) {
  const [order, setOrder] = useState(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    setOrder(invoice?.warehouse_order || null);
  }, [invoice?.id, invoice?.warehouse_order]);

  if (!invoice) return null;

  const clientName = order?.client_name
    || [invoice.client_first_name, invoice.client_last_name].filter(Boolean).join(' ')
    || invoice.client_email
    || '—';
  const totals = order?.totals || {};
  const groups = Array.isArray(order?.groups) ? order.groups : [];

  const handleGenerate = async () => {
    setWorking(true);
    try {
      const data = await generateWarehouseOrder(invoice.id);
      if (data?.order) {
        setOrder(data.order);
        onGenerated?.(data.order);
        toast.success(order ? 'Orden de almacén regenerada' : 'Orden de almacén generada');
      } else if (data?.empty) {
        toast.warning('Esta factura no tiene bultos vinculados: no se generó orden');
      } else {
        toast.error(data?.error || 'No se pudo generar la orden de almacén');
      }
    } catch (error) {
      toast.error('No se pudo generar la orden de almacén');
    }
    setWorking(false);
  };

  const handleDocument = async (mode) => {
    setWorking(true);
    try {
      await generateWarehouseOrderPdf({ invoice, order, appName: appName || 'TLEC CARGO', mode });
    } catch (error) {
      toast.error('No se pudo preparar el documento');
    }
    setWorking(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Orden de almacén
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[65vh] overflow-y-auto space-y-4 py-1">
          <div className="rounded-xl border border-border/70 bg-muted/40 p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Factura</p>
                <p className="font-semibold text-foreground">{invoice.invoice_number || '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Cliente</p>
                <p className="font-semibold text-foreground break-words">{clientName}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Shipping mark</p>
                <p className="font-mono text-foreground">{order?.shipping_mark || invoice.shipping_mark || '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Pagada el</p>
                <p className="text-foreground">{fmtDateTime(invoice.payment_date)}</p>
              </div>
            </div>
            {order?.generated_date && (
              <p className="mt-3 text-xs text-muted-foreground">
                Generada el {fmtDateTime(order.generated_date)} por {order.generated_by || '—'}
                {order.regenerated_date ? ` · Regenerada el ${fmtDateTime(order.regenerated_date)} por ${order.regenerated_by || '—'}` : ''}
              </p>
            )}
          </div>

          {!order ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <PackageOpen className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="font-semibold text-foreground">Esta factura todavía no tiene orden de almacén</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Se arma sola cuando la factura queda pagada (a mano, al aprobar el pago del cliente o con pago en línea). Si esta factura se pagó antes, genera la orden aquí.
              </p>
            </div>
          ) : groups.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              La orden guardada no tiene bultos agrupados.
            </div>
          ) : (
            <>
              {groups.map((group, index) => (
                <div key={`${group.shipping_mark}-${group.order_number}-${index}`} className="rounded-xl border border-border/70 bg-card p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {group.shipping_mark || order.shipping_mark || '—'}
                      </p>
                      <p className="font-semibold text-foreground">
                        N° de orden / envío: {group.order_number || 'Sin N° de orden'}
                      </p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary whitespace-nowrap">
                      {Number(group.bultos_count) || 0} bulto(s) · {Number(group.packages_count) || 0} paquete(s)
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(group.bultos || []).map((bulto, i) => (
                      <span
                        key={`${bulto.label_code}-${i}`}
                        className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[11px] text-foreground"
                      >
                        {bultoTag(bulto)}
                        {bulto.package_count ? ` · ${bulto.package_count} paq.` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              ))}

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-primary px-4 py-3 text-primary-foreground">
                <span className="font-display text-sm font-semibold uppercase tracking-wide">Total de bultos</span>
                <span className="font-semibold">
                  {Number(totals.bultos) || 0} bulto(s) · {Number(totals.packages) || 0} paquete(s) · {groups.length} orden(es)
                </span>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex flex-wrap gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => handleDocument('print')} disabled={!order || working}>
            <Printer className="h-4 w-4 mr-2" /> Imprimir
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => handleDocument('save')} disabled={!order || working}>
              <Download className="h-4 w-4 mr-2" /> Descargar PDF
            </Button>
            <Button onClick={handleGenerate} disabled={working}>
              {working ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              {order ? 'Regenerar' : 'Generar orden'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}