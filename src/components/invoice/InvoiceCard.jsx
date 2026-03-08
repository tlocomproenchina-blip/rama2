import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, CreditCard, Calendar, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import InvoicePDFGenerator from './InvoicePDFGenerator';

export default function InvoiceCard({ invoice, onPay, onDownload, showPayButton = false, onOtherPay, showOtherMethodsButton = false, onPayPal, showPayPalButton = false }) {
  const statusColors = {
    pendiente: 'bg-yellow-100 text-yellow-800',
    revision: 'bg-blue-100 text-blue-800',
    pagada: 'bg-green-100 text-green-800',
    vencida: 'bg-red-100 text-red-800',
    cancelada: 'bg-slate-100 text-slate-800'
  };

  const statusLabels = {
    pendiente: 'Pendiente',
    revision: 'En revisión',
    pagada: 'Pagada',
    vencida: 'Vencida',
    cancelada: 'Cancelada'
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-blue-50 rounded-xl">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg text-slate-800">{invoice.invoice_number}</CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                Consolidación: {invoice.consolidation_tracking}
              </p>
              <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(invoice.invoice_date), 'dd/MM/yyyy')}
                </span>
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  ${invoice.total.toFixed(2)}
                </span>
                {(invoice.stripe_invoice_pdf_url || invoice.stripe_hosted_invoice_url) && (
                  <a
                    href={invoice.stripe_invoice_pdf_url || invoice.stripe_hosted_invoice_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-dotted text-emerald-700 hover:text-emerald-800"
                  >
                    Ver factura de Stripe
                  </a>
                )}
              </div>
            </div>
          </div>
          <Badge className={statusColors[invoice.status]}>
            {statusLabels[invoice.status]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 mb-4">
          {invoice.items?.map((item, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span className="text-slate-600">{item.description}</span>
              <span className="font-medium text-slate-800">${item.total.toFixed(2)}</span>
            </div>
          ))}
          <div className="border-t pt-2 flex justify-between font-semibold text-slate-800">
            <span>Total</span>
            <span>${invoice.total.toFixed(2)}</span>
          </div>
        </div>

        {invoice.status === 'revision' && (
          <div className="mb-3 p-3 bg-amber-50 border border-amber-100 rounded-lg text-amber-800 text-sm">
            Pago enviado. Tu comprobante está en revisión por un administrador.
          </div>
        )}

         <div className="flex gap-2 flex-wrap">
          {invoice.status === 'pendiente' && invoice.stripe_hosted_invoice_url && (
            <Button asChild className="flex-1 bg-emerald-600 hover:bg-emerald-700">
              <a href={invoice.stripe_hosted_invoice_url} target="_blank" rel="noopener noreferrer">
                <CreditCard className="h-4 w-4 mr-2" />
                Pagar en Stripe
              </a>
            </Button>
          )}

          {showPayPalButton && invoice.status === 'pendiente' && (
            <Button 
              onClick={() => onPayPal?.(invoice)}
              variant="outline"
              className="flex-1"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Pagar con Débito / Crédito
            </Button>
          )}

          {/* Si está pagada o en revisión, nunca mostrar botón de Stripe */}
          {showOtherMethodsButton && invoice.status === 'pendiente' && (
            <Button 
              onClick={() => onOtherPay?.(invoice)}
              variant="outline"
              className="flex-1"
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Otros métodos de pago
            </Button>
          )}
          {/* Oculta acciones cuando está en revisión o pagada */}
          {(invoice.status === 'revision' || invoice.status === 'pagada') && null}
          <div className="flex-1 min-w-40">
            <InvoicePDFGenerator invoice={invoice} />
          </div>
        </div>

        {invoice.status === 'pagada' && invoice.payment_date && (
          <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-100">
            <p className="text-sm text-green-800">
              <strong>Pagada:</strong> {format(new Date(invoice.payment_date), 'dd/MM/yyyy HH:mm')}
            </p>
            {invoice.payment_reference && (
              <p className="text-xs text-green-700 mt-1">
                Ref: {invoice.payment_reference}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}