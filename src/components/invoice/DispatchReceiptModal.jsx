import React, { useMemo, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

/**
 * Genera un recibo de despacho en texto plano para copiar, a partir de una
 * factura marcada como pagada al proveedor.
 *
 * Formato:
 *   <shipping_mark>
 *   <nombre apellido>
 *   <cedula>
 *   <whatsapp>
 *   <dirección, ciudad, estado>
 *   *Facturas pagadas* (Numero de orden)
 *   25 - 13 - 7 - 6
 *
 * Los números de orden corresponden a los CBM registrados al momento de generar
 * la factura (items de tipo "Envío"), no al número de factura.
 */
function extractShippingOrderNumbers(invoice) {
  const items = invoice?.items || [];
  const numbers = [];
  for (const item of items) {
    const desc = String(item?.description || '');
    // Solo items de envío (excluir seguro, consolidación, etc.)
    if (!/^env[íi]o/i.test(desc)) continue;
    // Item consolidado con CBM manual: lista de órdenes en details.source_invoices
    const sourceList = item?.details?.source_invoices;
    if (Array.isArray(sourceList) && sourceList.length > 0) {
      sourceList.forEach((o) => {
        if (o && o !== '—') numbers.push(String(o).trim());
      });
      continue;
    }
    // Preferir el número de orden guardado en details.source_invoice
    let order = item?.details?.source_invoice;
    if (order === undefined || order === null || order === '' || order === '—') {
      // Fallback: extraer el primer número de la descripción (ej: "Envío - 25 (0.0040 CBM)" -> 25)
      // No aplica a items consolidados "X.XXXX CBM facturado" (el número sería el CBM)
      const cleaned = desc.replace(/^env[íi]o\s*-?\s*/i, '');
      const m = /cbm\s*facturado/i.test(cleaned) ? null : cleaned.match(/(\d+)/);
      order = m ? m[1] : null;
    }
    if (order !== null && order !== undefined && order !== '' && order !== '—') {
      numbers.push(String(order).trim());
    }
  }

  // Fallback para facturas antiguas con CBM manual: extraer de las notas
  // "…generada desde N factura(s): 12, 14, 15, 21. CBM total…"
  if (numbers.length === 0 && invoice?.notes) {
    const m = String(invoice.notes).match(/factura\(s\):\s*([^.]+)/i);
    if (m) {
      m[1].split(',').map((s) => s.trim()).forEach((o) => {
        if (o && o !== '—') numbers.push(o);
      });
    }
  }

  return Array.from(new Set(numbers));
}

export default function DispatchReceiptModal({ open, onClose, invoice }) {
  const [copied, setCopied] = useState(false);
  const [billingData, setBillingData] = useState(null);

  // Busca los datos de facturación del cliente cuando se abre el modal
  useEffect(() => {
    setBillingData(null);
    if (!open || !invoice?.client_email) return;
    let cancelled = false;
    (async () => {
      try {
        const users = await base44.entities.User.filter({ email: invoice.client_email }, '-updated_date', 1);
        if (!cancelled && users?.[0]) {
          const u = users[0];
          // Solo considerar datos de facturación personalizados (no usa datos de registro)
          if (u.billing_use_registration === false && u.billing_name) {
            setBillingData({
              billing_name: u.billing_name,
              billing_cedula_rif: u.billing_cedula_rif,
              billing_phone: u.billing_phone,
              billing_address: u.billing_address,
            });
          }
        }
      } catch (e) {
        // Silencioso: si falla, simplemente no se muestra la sección de facturación
      }
    })();
    return () => { cancelled = true; };
  }, [open, invoice?.client_email]);

  const text = useMemo(() => {
    if (!invoice) return '';

    const fullName = [invoice.client_first_name, invoice.client_last_name].filter(Boolean).join(' ').trim();
    const addressParts = [invoice.client_address, invoice.client_city, invoice.client_state].filter(Boolean);
    const address = addressParts.join(', ');

    const orders = extractShippingOrderNumbers(invoice);

    const lines = [];
    if (invoice.shipping_mark) lines.push(invoice.shipping_mark);
    if (fullName) lines.push(fullName);
    if (invoice.client_cedula) lines.push(invoice.client_cedula);
    if (invoice.client_whatsapp) lines.push(invoice.client_whatsapp);
    if (address) lines.push(address);
    lines.push('*Facturas pagadas* (Numero de orden)');
    lines.push(orders.join(' - '));

    // Sección de datos de facturación (solo si el cliente tiene datos personalizados)
    if (billingData) {
      lines.push('');
      lines.push('*Datos de Facturación*');
      if (billingData.billing_name) lines.push(`Razón Social: ${billingData.billing_name}`);
      if (billingData.billing_cedula_rif) lines.push(`Cédula o RIF: ${billingData.billing_cedula_rif}`);
      if (billingData.billing_phone) lines.push(`Número de contacto: ${billingData.billing_phone}`);
      if (billingData.billing_address) lines.push(`Dirección de facturación: ${billingData.billing_address}`);
    }

    return lines.join('\n');
  }, [invoice, billingData]);

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