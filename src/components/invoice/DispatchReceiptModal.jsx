import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check, Truck } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Genera un recibo de despacho en texto plano para copiar, a partir de una
 * factura marcada como pagada al proveedor y las facturas pagadas del cliente.
 *
 * Formato:
 *   <shipping_mark>
 *   <nombre apellido>
 *   <cedula>
 *   <whatsapp>
 *   <dirección, ciudad, estado>
 *   *Facturas pagadas* (Numero de orden)
 *   25 - 13 - 7 - 6
 */
function extractOrderNumber(invoiceNumber) {
  if (!invoiceNumber) return '';
  // Tomar la última secuencia de dígitos del número de factura (ej: FAC-000025 -> 25)
  const matches = String(invoiceNumber).match(/(\d+)(?!.*\d)/);
  if (matches) return String(parseInt(matches[1], 10));
  return String(invoiceNumber);
}

export default function DispatchReceiptModal({ open, onClose, invoice, clientInvoices }) {
  const [copied, setCopied] = useState(false);

  const text = useMemo(() => {
    if (!invoice) return '';

    const fullName = [invoice.client_first_name, invoice.client_last_name].filter(Boolean).join(' ').trim();
    const addressParts = [invoice.client_address, invoice.client_city, invoice.client_state].filter(Boolean);
    const address = addressParts.join(', ');

    // Facturas pagadas del cliente (incluye esta). Ordenadas por número de orden desc.
    const paid = (clientInvoices || [])
      .filter(inv => inv.status === 'pagada')
      .map(inv => extractOrderNumber(inv.invoice_number))
      .filter(Boolean);
    const uniqueOrders = Array.from(new Set(paid));
    uniqueOrders.sort((a, b) => Number(b) - Number(a));

    const lines = [];
    if (invoice.shipping_mark) lines.push(invoice.shipping_mark);
    if (fullName) lines.push(fullName);
    if (invoice.client_cedula) lines.push(invoice.client_cedula);
    if (invoice.client_whatsapp) lines.push(invoice.client_whatsapp);
    if (address) lines.push(address);
    lines.push('*Facturas pagadas* (Numero de orden)');
    lines.push(uniqueOrders.join(' - '));

    return lines.join('\n');
  }, [invoice, clientInvoices]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Recibo copiado al portapapeles');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-600" />
            Recibo de Despacho
          </DialogTitle>
        </DialogHeader>

        <div className="py-2">
          <p className="text-sm text-slate-500 mb-2">
            Datos de despacho del cliente. Cópialos en texto plano.
          </p>
          <pre className="whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 font-mono">
{text}
          </pre>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
          <Button onClick={handleCopy} className="bg-blue-600 hover:bg-blue-700">
            {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            {copied ? 'Copiado' : 'Copiar texto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}