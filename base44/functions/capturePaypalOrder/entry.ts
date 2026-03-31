import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

async function getAccessToken() {
  const clientId = Deno.env.get('PAYPAL_CLIENT_ID');
  const secret = Deno.env.get('PAYPAL_CLIENT_SECRET');
  if (!clientId || !secret) throw new Error('Faltan credenciales de PayPal');
  const creds = btoa(`${clientId}:${secret}`);
  const resp = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error_description || 'No se pudo obtener token de PayPal');
  return data.access_token;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const configs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' });
    const config = configs?.[0] || {};
    if (config.external_services_enabled === false) {
      return Response.json({ error: config.external_services_message || 'Modo demo activo: PayPal desactivado.' }, { status: 503 });
    }

    const body = await req.json().catch(() => ({}));
    const { order_id, invoice_id } = body || {};
    if (!order_id || !invoice_id) {
      return Response.json({ error: 'Faltan parámetros order_id o invoice_id' }, { status: 400 });
    }

    const accessToken = await getAccessToken();

    const capRes = await fetch(`https://api-m.paypal.com/v2/checkout/orders/${order_id}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const capData = await capRes.json();
    if (!capRes.ok) {
      return Response.json({ error: capData?.message || 'No se pudo capturar el pago' }, { status: 400 });
    }

    const capture = capData?.purchase_units?.[0]?.payments?.captures?.[0];
    const status = capture?.status || capData?.status;
    if (status !== 'COMPLETED') {
      return Response.json({ error: 'Pago no completado', details: capData }, { status: 400 });
    }

    // Actualizar factura como pagada
    const now = new Date().toISOString();
    await base44.entities.Invoice.update(invoice_id, {
      status: 'pagada',
      payment_date: now,
      payment_method: 'paypal',
      payment_reference: capture?.id || order_id,
      payment_history: [
        ...(Array.isArray(capData.payment_history) ? capData.payment_history : []),
        {
          method_brand: 'paypal',
          last4: '',
          amount_paid: Number(capture?.amount?.value || 0),
          currency: (capture?.amount?.currency_code || 'USD'),
          date: now,
          payment_intent_id: capture?.id || order_id,
          charge_id: capture?.id || '',
        },
      ],
    });

    return Response.json({ success: true, capture_id: capture?.id || order_id });
  } catch (error) {
    return Response.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
});