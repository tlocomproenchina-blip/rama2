import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@14.25.0';

function getStripeSecretKey() {
  return (
    Deno.env.get('STRIPE_SECRET_KEY') ||
    Deno.env.get('CLAVESECRETA') ||
    Deno.env.get('STRIPEAPI') ||
    Deno.env.get('STRIPE_SECRET') ||
    null
  );
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const paymentIntentId = body?.payment_intent_id;
    if (!paymentIntentId) {
      return Response.json({ error: 'Missing payment_intent_id' }, { status: 400 });
    }

    const secret = getStripeSecretKey();
    if (!secret) {
      return Response.json({ error: 'Stripe secret key is not set' }, { status: 500 });
    }

    const stripe = new Stripe(secret, { apiVersion: '2023-10-16' });

    // Retrieve and verify PI
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (!pi || pi.status !== 'succeeded') {
      return Response.json({ error: 'PaymentIntent is not succeeded', status: pi?.status || 'unknown' }, { status: 400 });
    }

    // Find related invoice
    let invoiceId = pi.metadata?.invoice_id || '';
    let invoice = null;
    if (invoiceId) {
      const matches = await base44.asServiceRole.entities.Invoice.filter({ id: invoiceId });
      invoice = matches?.[0] || null;
    } else {
      // Fallback: search by stored intent id
      const matches = await base44.asServiceRole.entities.Invoice.filter({ stripe_payment_intent_id: pi.id });
      invoice = matches?.[0] || null;
      invoiceId = invoice?.id || '';
    }

    if (!invoice) {
      return Response.json({ error: 'Related invoice not found' }, { status: 404 });
    }

    // Authorization: only owner or admin can trigger
    if (user.role !== 'admin' && invoice.client_email !== user.email) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update as paid (service role to bypass any perms)
    await base44.asServiceRole.entities.Invoice.update(invoice.id, {
      status: 'pagada',
      payment_date: new Date().toISOString(),
      payment_method: 'stripe',
      payment_reference: pi.id,
      stripe_payment_intent_id: pi.id,
    });

    return Response.json({ success: true, invoice_id: invoice.id, status: 'pagada' });
  } catch (error) {
    console.error('verifyStripePayment error:', error);
    return Response.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
});