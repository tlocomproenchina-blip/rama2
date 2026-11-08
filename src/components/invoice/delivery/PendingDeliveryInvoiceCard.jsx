import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, DollarSign, FileText } from 'lucide-react';
import { format } from 'date-fns';

// Factura sin monto visible: el total se genera cuando el cliente elige la entrega.
export default function PendingDeliveryInvoiceCard({ invoice, onChoose }) {
  return (
    <Card className="border-0 shadow-lg">
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-lg font-semibold text-slate-800"><FileText className="h-5 w-5 text-primary" /> {invoice.invoice_number || 'Factura'}</p>
            {invoice.consolidation_tracking && <p className="mt-1 break-words text-sm text-slate-500">Envíos: {invoice.consolidation_tracking}</p>}
            {invoice.invoice_date && (
              <p className="mt-2 flex items-center gap-1 text-xs text-slate-500"><Calendar className="h-3 w-3" /> {format(new Date(invoice.invoice_date), 'dd/MM/yyyy')}</p>
            )}
          </div>
          <Badge className="bg-yellow-100 text-yellow-800">Disponible para pago</Badge>
        </div>
        <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm text-slate-600">
          Elige cómo quieres recibir tu carga y te mostramos el monto a pagar con su factura digital.
        </div>
        <Button className="w-full" onClick={() => onChoose(invoice)}>
          <DollarSign className="mr-2 h-4 w-4" /> Pagar factura
        </Button>
      </CardContent>
    </Card>
  );
}