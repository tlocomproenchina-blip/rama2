import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

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
    const {
      client_first_name,
      client_last_name,
      client_city,
      client_phone,
      client_email,
      shipping_mark,
      notes,
      method,
    } = body || {};

    if (!client_email || !client_email.includes('@')) {
      return Response.json({ error: 'Email del cliente es requerido' }, { status: 400 });
    }
    if (!method) {
      return Response.json({ error: 'Método de pago es requerido' }, { status: 400 });
    }

    // Cargar config
    const configs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' });
    const config = (configs && configs[0]) || {};
    const amount = Number(config.quote_fee_amount) || 20;
    const enabledMethods = (Array.isArray(config.quote_fee_enabled_methods) && config.quote_fee_enabled_methods.length
      ? config.quote_fee_enabled_methods
      : ['paypal']).filter((m) => m !== 'stripe');

    if (!enabledMethods.includes(method)) {
      return Response.json({ error: 'Método de pago no habilitado' }, { status: 400 });
    }

    // Lookup shipping mark si no se proporcionó
    let resolvedShippingMark = shipping_mark || '';
    if (!resolvedShippingMark && client_email) {
      try {
        const users = await base44.asServiceRole.entities.User.filter({ email: client_email.toLowerCase() }, '-created_date', 1);
        if (users && users[0] && users[0].shipping_mark) {
          resolvedShippingMark = users[0].shipping_mark;
        }
      } catch (_) {}
    }

    // Crear registro de pago pendiente
    const payment = await base44.asServiceRole.entities.QuoteFeePayment.create({
      client_first_name: client_first_name || '',
      client_last_name: client_last_name || '',
      client_city: client_city || '',
      client_phone: client_phone || '',
      client_email: client_email.toLowerCase(),
      shipping_mark: resolvedShippingMark,
      notes: notes || '',
      amount,
      method,
      status: 'pendiente',
    });

    const result = { payment_id: payment.id, amount, method };

    // Para PayPal: crear orden
    if (method === 'paypal') {
      const accessToken = await getPayPalAccessToken();
      let brandName = 'TLEC CARGO';
      try {
        brandName = config.invoice_company_name || brandName;
      } catch (_) {}
      const origin = (req.headers.get('origin') || 'https://tleccargo.base44.app');
      const orderPayload = {
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: String(payment.id),
            description: 'Tarifa de presupuesto - TLEC CARGO',
            amount: {
              currency_code: 'USD',
              value: Number(amount).toFixed(2),
            },
          },
        ],
        application_context: {
          brand_name: brandName,
          landing_page: 'BILLING',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW',
          return_url: `${origin}/QuoteFeePayment?paypal_return=1`,
          cancel_url: `${origin}/QuoteFeePayment?paypal_cancel=1`,
        },
      };
      const createRes = await fetch('https://api-m.paypal.com/v2/checkout/orders', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderPayload),
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        return Response.json({ error: createData?.message || 'No se pudo crear la orden de PayPal' }, { status: 400 });
      }
      const approval = (createData?.links || []).find((l) => l.rel === 'approve');
      await base44.asServiceRole.entities.QuoteFeePayment.update(payment.id, {
        paypal_order_id: createData.id,
      });
      result.paypal_order_id = createData.id;
      result.paypal_approval_url = approval?.href || null;
    }

    // Para métodos manuales (transferencia, binance, usdt, etc.): no se requiere nada extra,
    // el cliente confirmará con referencia/proof en confirmQuoteFeePayment.

    return Response.json(result);
  } catch (error) {
    console.error('createQuoteFeePayment error:', error);
    return Response.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}