import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let payload = {};
    try { payload = await req.json(); } catch (_) { payload = {}; }

    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const requestId = payload.request_id;
    if (!requestId) {
      return Response.json({ error: 'Missing request_id' }, { status: 400 });
    }

    // Load request and app config
    const [reqs, cfgs] = await Promise.all([
      base44.asServiceRole.entities.AssistedPaymentRequest.filter({ id: requestId }),
      base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' }).catch(() => [])
    ]);

    if (!reqs || reqs.length === 0) {
      return Response.json({ error: 'AssistedPaymentRequest not found' }, { status: 404 });
    }

    const apReq = reqs[0];
    if (apReq.invoice_id) {
      return Response.json({ success: true, invoice_id: apReq.invoice_id, already_exists: true });
    }

    const cfg = cfgs?.[0] || {};

    const baseAmount = Number(apReq.amount || 0);
    const percent = Number(apReq.fee_percentage ?? cfg.payments_assisted_fee_percentage ?? 5);
    const feeAmount = Number(
      apReq.fee_amount ?? Math.round(baseAmount * (percent / 100) * 100) / 100
    );
    const total = Math.round((baseAmount + feeAmount) * 100) / 100;

    const nowIso = new Date().toISOString();
    const dueMs = 7 * 24 * 60 * 60 * 1000; // 7 days
    const dueIso = new Date(Date.now() + dueMs).toISOString();

    // Create local Invoice with 2 items
    const invoice = await base44.asServiceRole.entities.Invoice.create({
      client_email: apReq.client_email,
      invoice_date: nowIso,
      due_date: dueIso,
      items: [
        {
          description: 'Pago asistido - Monto base',
          quantity: 1,
          unit_price: baseAmount,
          total: baseAmount,
          details: {
            provider: apReq.provider,
            link_url: apReq.link_url,
          }
        },
        {
          description: `Comisión de servicio (${percent}%)`,
          quantity: 1,
          unit_price: feeAmount,
          total: feeAmount,
          details: {
            provider: apReq.provider,
            reference: 'assisted_payment_fee'
          }
        }
      ],
      subtotal: baseAmount + feeAmount,
      tax: 0,
      total: total,
      status: 'pendiente',
      notes: `Pago asistido — Plataforma: ${apReq.provider || 'N/A'} — Enlace: ${apReq.link_url || 'N/A'}`
    });

    // Link back to request
    await base44.asServiceRole.entities.AssistedPaymentRequest.update(apReq.id, {
      status: 'en_proceso',
      invoice_id: invoice.id
    });

    // Trigger Stripe invoice creation & email via existing function (automation mode)
    const stripeRes = await base44.asServiceRole.functions.invoke('createStripeInvoice', {
      event: { entity_name: 'Invoice', entity_id: invoice.id, type: 'create' }
    });

    return Response.json({
      success: true,
      invoice_id: invoice.id,
      stripe: stripeRes?.data || null
    });
  } catch (error) {
    const message = (error && typeof error === 'object' && 'message' in error) ? error.message : 'Internal Server Error';
    return Response.json({ error: String(message) }, { status: 500 });
  }
});