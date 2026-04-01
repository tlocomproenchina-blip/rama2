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

    const body = await req.json().catch(() => ({}));
    const { invoice_id, currency = 'USD', return_url, cancel_url } = body || {};
    if (!invoice_id) {
      return Response.json({ error: 'Falta invoice_id' }, { status: 400 });
    }

    const list = await base44.entities.Invoice.filter({ id: invoice_id });
    const invoice = list?.[0];
    if (!invoice) return Response.json({ error: 'Factura no encontrada' }, { status: 404 });
    if (invoice.status !== 'pendiente') {
      return Response.json({ error: 'La factura no está pendiente' }, { status: 400 });
    }

    // Opcional: nombre de marca para checkout
    let brandName = 'TLEC GROUP LLC';
    try {
      const cfgs = await base44.entities.AppConfig.filter({ config_key: 'main' });
      brandName = (cfgs?.[0]?.invoice_company_name) || brandName;
    } catch (_) {}

    const accessToken = await getAccessToken();

    const amount = Number(invoice.total || 0).toFixed(2);
    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: String(invoice.id),
          amount: {
            currency_code: String(currency).toUpperCase(),
            value: amount,
          },
        },
      ],
      application_context: {
        brand_name: brandName,
        landing_page: 'BILLING', // mostrar tarjeta primero (guest checkout)
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
        return_url: return_url || 'https://example.com/return-paypal',
        cancel_url: cancel_url || 'https://example.com/cancel-paypal',
      },
    };

    const createRes = await fetch('https://api-m.paypal.com/v2/checkout/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    });
    const createData = await createRes.json();
    if (!createRes.ok) {
      return Response.json({ error: createData?.message || 'No se pudo crear la orden' }, { status: 400 });
    }

    const approval = (createData?.links || []).find((l) => l.rel === 'approve');
    return Response.json({ order_id: createData.id, approval_url: approval?.href || null });
  } catch (error) {
    return Response.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
});