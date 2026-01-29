import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';

export default function RecentPaymentsWidget({ invoices }) {
  const paidInvoices = invoices
    .filter(inv => inv.status === 'pagada' && inv.payment_date)
    .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))
    .slice(0, 3);

  const paymentMethodLabels = {
    binance: 'Binance',
    usdt_trc20: 'USDT TRC20',
    paypal: 'PayPal',
    stripe: 'Tarjeta',
    debito_internacional: 'Débito Int.',
    wally: 'Wally',
    zinli: 'Zinli',
    wise: 'Wise',
    skrill: 'Skrill',
    pago_movil_usdt: 'Pago Móvil USDT'
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <CreditCard className="h-5 w-5 text-emerald-600" />
          Pagos Recientes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {paidInvoices.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-4">
            No tienes pagos registrados
          </p>
        ) : (
          <div className="space-y-3">
            {paidInvoices.map((invoice) => (
              <Link
                key={invoice.id}
                to={createPageUrl('MyInvoices')}
                className="block p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-mono text-sm font-medium text-slate-800">
                      {invoice.invoice_number}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {format(new Date(invoice.payment_date), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-emerald-600">
                      ${invoice.total.toFixed(2)}
                    </p>
                    <Badge className="bg-green-100 text-green-800 text-xs mt-1">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Pagado
                    </Badge>
                  </div>
                </div>
                {invoice.payment_method && (
                  <p className="text-xs text-slate-500">
                    Método: {paymentMethodLabels[invoice.payment_method] || invoice.payment_method}
                  </p>
                )}
              </Link>
            ))}
            {invoices.filter(i => i.status === 'pagada').length > 3 && (
              <Link
                to={createPageUrl('MyInvoices')}
                className="block text-center text-sm text-blue-600 hover:text-blue-700 font-medium pt-2"
              >
                Ver todos los pagos
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}