import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fiscalCall } from '@/lib/fiscalApi';
import { invokeErrorMessage } from '@/lib/invokeErrorMessage';

// Permite iniciar una solicitud para una factura ya pagada o con comprobante enviado.
export default function NewFiscalRequestCard({ invoices }) {
  const navigate = useNavigate();
  const [invoiceId, setInvoiceId] = useState('');
  const [busy, setBusy] = useState(false);
  if (!invoices.length) return null;

  const start = async () => {
    setBusy(true);
    try {
      const res = await fiscalCall('registerIntent', { invoice_id: invoiceId });
      navigate(`/FiscalInvoiceRequest?request=${res.request.id}`);
    } catch (err) {
      toast.error(invokeErrorMessage(err, 'No se pudo iniciar la solicitud'));
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <p className="text-sm font-semibold text-foreground">Solicitar factura fiscal para otra factura</p>
        <div className="flex flex-wrap gap-2">
          <div className="min-w-[220px] flex-1">
            <Select value={invoiceId} onValueChange={setInvoiceId}>
              <SelectTrigger><SelectValue placeholder="Elige una factura" /></SelectTrigger>
              <SelectContent>
                {invoices.map((inv) => (
                  <SelectItem key={inv.id} value={inv.id}>Factura {inv.invoice_number} - ${Number(inv.total || 0).toFixed(2)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" disabled={!invoiceId || busy} onClick={start}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Iniciar solicitud
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}