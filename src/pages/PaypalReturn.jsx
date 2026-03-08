import React, { useEffect, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PaypalReturn() {
  const navigate = useNavigate();
  const [state, setState] = useState({ status: 'processing', message: 'Confirmando pago...' });

  useEffect(() => {
    const url = new URL(window.location.href);
    const orderId = url.searchParams.get('token'); // PayPal returns ?token=
    const invoiceId = url.searchParams.get('invoiceId');

    if (!orderId || !invoiceId) {
      setState({ status: 'error', message: 'Parámetros inválidos en la URL.' });
      return;
    }

    (async () => {
      try {
        const res = await base44.functions.invoke('capturePaypalOrder', { order_id: orderId, invoice_id: invoiceId });
        if (res.status === 200 && res.data?.success) {
          setState({ status: 'success', message: 'Pago confirmado. ¡Gracias!' });
        } else {
          setState({ status: 'error', message: res.data?.error || 'No se pudo confirmar el pago.' });
        }
      } catch (e) {
        setState({ status: 'error', message: e?.message || 'Error al confirmar el pago.' });
      }
    })();
  }, []);

  const goToInvoices = () => navigate(createPageUrl('MyInvoices'));

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Resultado del Pago</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {state.status === 'processing' && (
            <>
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
              <p className="text-slate-600">{state.message}</p>
            </>
          )}
          {state.status === 'success' && (
            <>
              <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-600" />
              <p className="text-emerald-700">{state.message}</p>
              <Button onClick={goToInvoices} className="w-full bg-emerald-600 hover:bg-emerald-700">Ir a Mis Facturas</Button>
            </>
          )}
          {state.status === 'error' && (
            <>
              <XCircle className="h-10 w-10 mx-auto text-rose-600" />
              <p className="text-rose-700">{state.message}</p>
              <Button onClick={goToInvoices} variant="outline" className="w-full">Volver</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}