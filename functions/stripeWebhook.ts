import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@14.25.0';

// Helper: fetch Stripe secret from any of the possible env names already used in the app
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

    // Raw body and signature for webhook verification
    const rawBody = await req.text();
    const sig = req.headers.get('stripe-signature') || req.headers.get('Stripe-Signature');
    const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    if (!endpointSecret) {
      return Response.json({ error: 'Missing STRIPE_WEBHOOK_SECRET' }, { status: 500 });
    }

    const stripeSecret = getStripeSecretKey() || '';
    const stripe = new Stripe(stripeSecret, { apiVersion: '2023-10-16' });

    let event;
    try {
      // IMPORTANT for Deno: use async version
      event = await stripe.webhooks.constructEventAsync(rawBody, sig, endpointSecret);
    } catch (err) {
      console.error('⚠️  Webhook signature verification failed.', err?.message || err);
      return Response.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Only initialize Base44 client AFTER verifying Stripe authenticity
    const base44 = createClientFromRequest(req);

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        const invoiceId = pi?.metadata?.invoice_id;
        if (invoiceId) {
          try {
            await base44.asServiceRole.entities.Invoice.update(invoiceId, {
              status: 'pagada',
              payment_date: new Date().toISOString(),
              payment_method: 'stripe',
              payment_reference: pi.id,
              stripe_payment_intent_id: pi.id,
            });
          } catch (e) {
            console.error('Failed to update invoice as paid:', e);
          }
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        const invoiceId = pi?.metadata?.invoice_id;
        if (invoiceId) {
          try {
            await base44.asServiceRole.entities.Invoice.update(invoiceId, {
              // Keep status as is; attach reference for troubleshooting
              payment_reference: pi.id,
              stripe_payment_intent_id: pi.id,
            });
          } catch (e) {
            console.error('Failed to record failed payment on invoice:', e);
          }
        }
        break;
      }

      case 'invoice.paid': {
        const invObj: any = event.data.object;
        const base44Id = invObj?.metadata?.base44_invoice_id;
        if (base44Id) {
          try {
            await base44.asServiceRole.entities.Invoice.update(base44Id, {
              status: 'pagada',
              payment_date: new Date().toISOString(),
              payment_method: 'stripe_invoice',
              payment_reference: invObj.id,
            });
          } catch (e) {
            console.error('Failed to update invoice (invoice.paid):', e);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invObj: any = event.data.object;
        const base44Id = invObj?.metadata?.base44_invoice_id;
        if (base44Id) {
          try {
            await base44.asServiceRole.entities.Invoice.update(base44Id, {
              // keep status, just record reference
              payment_reference: invObj.id,
            });
          } catch (e) {
            console.error('Failed to record failed stripe invoice:', e);
          }
        }
        break;
      }

      default: {
        // No-op for other event types
        break;
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return Response.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
});