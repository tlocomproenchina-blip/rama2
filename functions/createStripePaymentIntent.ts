import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@14.25.0';

// Helper to read the Stripe secret from available env names
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

    const stripeSecret = getStripeSecretKey();
    if (!stripeSecret) {
      return Response.json({ error: 'Stripe secret key is not set. Please configure STRIPE_SECRET_KEY.' }, { status: 500 });
    }

    const stripe = new Stripe(stripeSecret, { apiVersion: '2023-10-16' });

    const body = await req.json().catch(() => ({}));
    const { invoice_id, amount, currency = 'usd', description } = body || {};

    if (!invoice_id && (typeof amount !== 'number' || isNaN(amount))) {
      return Response.json({ error: 'Provide either invoice_id or a numeric amount.' }, { status: 400 });
    }

    let amountInCents = 0;
    let invoice = null;

    if (invoice_id) {
      // Fetch invoice by id
      const matches = await base44.entities.Invoice.filter({ id: invoice_id });
      if (!matches || matches.length === 0) {
        return Response.json({ error: 'Invoice not found' }, { status: 404 });
      }
      invoice = matches[0];

      // Only allow owner or admin to initiate payment for this invoice
      const isOwner = invoice.client_email && invoice.client_email === user.email;
      const isAdmin = user.role === 'admin';
      if (!isOwner && !isAdmin) {
        return Response.json({ error: 'Forbidden: You cannot pay this invoice' }, { status: 403 });
      }

      // Calculate amount from invoice total
      if (typeof invoice.total !== 'number' || isNaN(invoice.total) || invoice.total <= 0) {
        return Response.json({ error: 'Invoice total is invalid or missing' }, { status: 400 });
      }
      amountInCents = Math.round(invoice.total * 100);

      // If there is an existing PaymentIntent, try to reuse it
      if (invoice.stripe_payment_intent_id) {
        try {
          const existing = await stripe.paymentIntents.retrieve(invoice.stripe_payment_intent_id);
          // Reuse if not succeeded/canceled
          if (existing && existing.status && existing.status !== 'canceled' && existing.status !== 'succeeded') {
            return Response.json({
              payment_intent_id: existing.id,
              client_secret: existing.client_secret,
              amount: existing.amount,
              currency: existing.currency,
              status: existing.status,
              reused: true,
            });
          }
        } catch (_) {
          // If retrieval fails, we will create a new one below
        }
      }
    } else {
      // Direct amount (no invoice)
      if (amount <= 0) {
        return Response.json({ error: 'Amount must be greater than zero' }, { status: 400 });
      }
      amountInCents = Math.round(amount * 100);
    }

    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency,
      automatic_payment_methods: { enabled: true },
      receipt_email: user.email,
      description: description || (invoice ? `Pago de factura ${invoice.invoice_number || invoice.id}` : 'Pago en línea'),
      metadata: {
        user_email: user.email,
        invoice_id: invoice?.id || '',
        consolidation_id: invoice?.consolidation_id || '',
      },
    });

    // Persist PaymentIntent id on the invoice when applicable
    if (invoice) {
      const canUpdateAsUser = invoice.client_email === user.email || user.role === 'admin';
      try {
        if (canUpdateAsUser) {
          await base44.entities.Invoice.update(invoice.id, {
            stripe_payment_intent_id: paymentIntent.id,
            payment_method: 'stripe',
          });
        } else {
          // Fallback with elevated privileges only if necessary
          await base44.asServiceRole.entities.Invoice.update(invoice.id, {
            stripe_payment_intent_id: paymentIntent.id,
            payment_method: 'stripe',
          });
        }
      } catch (e) {
        // Do not fail the whole request if invoice update fails; surface info for debugging
        console.warn('Failed to update invoice with PaymentIntent id', e);
      }
    }

    return Response.json({
      payment_intent_id: paymentIntent.id,
      client_secret: paymentIntent.client_secret,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
    });
  } catch (error) {
    console.error('Stripe PaymentIntent error:', error);
    return Response.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
});