import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { fulfillQuoteFeePayment } from '../../shared/quoteFeeFulfillment.ts';

async function getPayPalAccessToken() {
  const clientId = Deno.env.get('PAYPAL_CLIENT_ID');
  const secret = Deno.env.get('PAYPAL_CLIENT_SECRET');
  if (!clientId || !secret) throw new Error('Faltan credenciales de PayPal');
  const creds = btoa(`${clientId}:${secret}`);
  const resp = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error_description || 'No se pudo obtener token de PayPal');
  return data.access_token;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { payment_id, paypal_order_id, payment_reference, proof_url } = body || {};

    if (!payment_id) {
      return Response.json({ error: 'payment_id es requerido' }, { status: 400 });
    }

    const payments = await base44.asServiceRole.entities.QuoteFeePayment.filter({ id: payment_id });
    const payment = payments && payments[0];
    if (!payment) {
      return Response.json({ error: 'Pago no encontrado' }, { status: 404 });
    }
    if (payment.status === 'pagado') {
      return Response.json({ already_paid: true, quote_token: payment.generated_quote_token, quote_number: payment.generated_quote_number });
    }

    let transactionRef = payment_reference || '';

    // PayPal: capturar la orden
    if (payment.method === 'paypal' && (paypal_order_id || payment.paypal_order_id)) {
      const orderId = paypal_order_id || payment.paypal_order_id;
      const accessToken = await getPayPalAccessToken();
      const capRes = await fetch(`https://api-m.paypal.com/v2/checkout/orders/${orderId}/capture`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      const capData = await capRes.json();
      if (!capRes.ok) {
        return Response.json({ error: capData?.message || 'No se pudo capturar el pago de PayPal' }, { status: 400 });
      }
      const capture = capData?.purchase_units?.[0]?.payments?.captures?.[0];
      const status = capture?.status || capData?.status;
      if (status !== 'COMPLETED') {
        return Response.json({ error: 'Pago de PayPal no completado', details: capData }, { status: 400 });
      }
      transactionRef = capture?.id || orderId;
    }

    // Métodos manuales: guardar referencia/comprobante
    if (payment_reference || proof_url) {
      const updateData = {};
      if (payment_reference) updateData.payment_reference = payment_reference;
      if (proof_url) updateData.proof_url = proof_url;
      await base44.asServiceRole.entities.QuoteFeePayment.update(payment_id, updateData);
    }

    // Fulfill: marcar pagado, generar quote, enviar email
    const result = await fulfillQuoteFeePayment(base44, payment_id, transactionRef);

    return Response.json({
      success: true,
      quote_id: result.quote_id,
      quote_token: result.quote_token || (result.payment && result.payment.generated_quote_token),
      quote_number: result.quote_number || (result.payment && result.payment.generated_quote_number),
      already: result.already,
    });
  } catch (error) {
    console.error('confirmQuoteFeePayment error:', error);
    return Response.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}