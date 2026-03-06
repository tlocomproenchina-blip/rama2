import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Stripe from 'npm:stripe@14.25.0';

function getStripeSecretKey() {
  return (
    Deno.env.get('STRIPE_SECRET_KEY') ||
    Deno.env.get('STRIPEAPI') ||
    Deno.env.get('stripe_secret_key') ||
    Deno.env.get('STRIPE_SK') ||
    null
  );
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Auth - admin only
    let user = null;
    try { user = await base44.auth.me(); } catch {}
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });

    let payload = {};
    try { payload = await req.json(); } catch { payload = {}; }

    const assistedId = payload.assisted_request_id;
    if (!assistedId) {
      return Response.json({ error: 'Missing assisted_request_id' }, { status: 400 });
    }

    const stripeSecret = getStripeSecretKey();
    if (!stripeSecret) {
      return Response.json({ error: 'Stripe secret key not configured' }, { status: 500 });
    }
    const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' });

    // Load AssistedPaymentRequest
    const [reqs, cfgArr] = await Promise.all([
      base44.asServiceRole.entities.AssistedPaymentRequest.filter({ id: assistedId }),
      base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' }).catch(() => [])
    ]);
    if (!reqs || reqs.length === 0) {
      return Response.json({ error: 'Assisted request not found' }, { status: 404 });
    }
    const ap = reqs[0];
    const daysUntilDue = (cfgArr?.[0]?.invoice_overdue_days && Number(cfgArr[0].invoice_overdue_days)) || 7;

    // Load user by email
    const users = await base44.asServiceRole.entities.User.filter({ email: ap.client_email });
    if (!users || users.length === 0) {
      return Response.json({ error: 'Client user not found' }, { status: 404 });
    }
    let client = users[0];

    // Ensure Stripe customer exists
    if (!client.stripe_customer_id) {
      const resp = await base44.asServiceRole.functions.invoke('createStripeCustomer', { user_id: client.id });
      const customerId = resp?.data?.stripe_customer_id || resp?.data?.customer_id || resp?.data?.id;
      if (customerId) {
        client = { ...client, stripe_customer_id: String(customerId) };
      } else {
        // Try refetch in case function updated the user
        const refreshed = await base44.asServiceRole.entities.User.filter({ id: client.id });
        client = refreshed?.[0] || client;
      }
    }

    const total = Number(ap.total_amount || ap.amount || 0);
    if (!Number.isFinite(total) || total <= 0) {
      return Response.json({ error: 'Invalid total amount' }, { status: 400 });
    }
    const currency = String(ap.currency || 'USD').toLowerCase();

    // Create invoice (draft)
    const description = [
      `Pago Asistido – Solicitud ${ap.id}`,
      ap.link_url ? `Enlace: ${ap.link_url}` : null,
      ap.provider ? `Proveedor: ${String(ap.provider).toUpperCase()}` : null,
      `Monto total: $${total.toFixed(2)} ${currency.toUpperCase()}`
    ].filter(Boolean).join('\n');

    const stripeInvoice = await stripe.invoices.create({
      customer: client.stripe_customer_id,
      collection_method: 'send_invoice',
      days_until_due: daysUntilDue,
      description,
      metadata: {
        type: 'assisted_payment',
        assisted_payment_request_id: String(ap.id),
        link_url: ap.link_url || '',
        provider: ap.provider || ''
      },
      statement_descriptor: 'TLEC CARGO LTD',
      auto_advance: false
    });

    // Single line item for the assisted payment total
    await stripe.invoiceItems.create({
      customer: client.stripe_customer_id,
      invoice: stripeInvoice.id,
      amount: Math.round(total * 100),
      currency,
      description: 'Pago Asistido'
    });

    // Finalize and retrieve URL
    const finalized = await stripe.invoices.finalizeInvoice(stripeInvoice.id);
    const fresh = await stripe.invoices.retrieve(finalized.id);

    // Update request notes
    try {
      const note = `Stripe invoice creada (${finalized.id})${fresh.hosted_invoice_url ? ` • URL: ${fresh.hosted_invoice_url}` : ''}`;
      const admin_comment = [ap.admin_comment, note].filter(Boolean).join(' | ');
      await base44.asServiceRole.entities.AssistedPaymentRequest.update(ap.id, { admin_comment });
    } catch {}

    // Send invoice email from Stripe
    let sent = null;
    try { sent = await stripe.invoices.sendInvoice(finalized.id); } catch {}

    return Response.json({
      success: true,
      stripe_invoice_id: finalized.id,
      hosted_invoice_url: fresh.hosted_invoice_url || null,
      email_sent: !!sent
    });
  } catch (error) {
    const message = (error && typeof error === 'object' && 'message' in error) ? error.message : 'Internal Server Error';
    return Response.json({ error: String(message) }, { status: 500 });
  }
});