import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Stripe from 'npm:stripe@14.23.0';

function getStripeSecretKey() {
  return Deno.env.get('STRIPE_SECRET_KEY') || Deno.env.get('CLAVESECRETA') || Deno.env.get('STRIPEAPI') || null;
}

function toIso(epochSeconds) {
  return epochSeconds ? new Date(epochSeconds * 1000).toISOString() : null;
}

async function findPlan(base44, subscription, fallbackPlanCode = '') {
  const priceId = subscription?.items?.data?.[0]?.price?.id || null;
  if (priceId) {
    const byPrice = await base44.asServiceRole.entities.SubscriptionPlan.filter({ stripe_price_id: priceId }, '-updated_date', 1);
    if (byPrice?.[0]) return byPrice[0];
  }
  if (fallbackPlanCode) {
    const byCode = await base44.asServiceRole.entities.SubscriptionPlan.filter({ plan_code: fallbackPlanCode }, '-updated_date', 1);
    if (byCode?.[0]) return byCode[0];
  }
  return null;
}

async function upsertTenantSubscription(base44, subscription, metadata = {}) {
  const tenantId = subscription?.metadata?.tenant_id || metadata?.tenant_id;
  if (!tenantId) return;

  const plan = await findPlan(base44, subscription, subscription?.metadata?.plan_code || metadata?.plan_code || '');
  const price = subscription?.items?.data?.[0]?.price || null;
  const productId = typeof price?.product === 'string' ? price.product : price?.product?.id || null;
  const priceId = price?.id || null;

  const record = {
    tenant_id: tenantId,
    plan_code: plan?.plan_code || subscription?.metadata?.plan_code || metadata?.plan_code || 'unknown',
    plan_name: plan?.name || metadata?.plan_name || 'Plan SaaS',
    status: subscription?.status || 'active',
    billing_cycle: plan?.billing_cycle || metadata?.billing_cycle,
    amount: plan?.price || ((price?.unit_amount || 0) / 100),
    currency: plan?.currency || price?.currency || 'usd',
    billing_email: subscription?.metadata?.billing_email || metadata?.billing_email || '',
    stripe_customer_id: typeof subscription?.customer === 'string' ? subscription.customer : subscription?.customer?.id || null,
    stripe_subscription_id: subscription?.id || null,
    stripe_product_id: productId,
    stripe_price_id: priceId,
    current_period_start: toIso(subscription?.current_period_start),
    current_period_end: toIso(subscription?.current_period_end),
    trial_start: toIso(subscription?.trial_start),
    trial_end: toIso(subscription?.trial_end),
    cancel_at_period_end: !!subscription?.cancel_at_period_end,
    canceled_at: toIso(subscription?.canceled_at),
  };

  const existing = await base44.asServiceRole.entities.TenantSubscription.filter({ tenant_id: tenantId }, '-updated_date', 20);
  const current = (existing || []).find((item) => item.stripe_subscription_id === record.stripe_subscription_id) || (existing || []).find((item) => ['active', 'trialing', 'past_due', 'incomplete'].includes(item.status));

  if (current) {
    await base44.asServiceRole.entities.TenantSubscription.update(current.id, record);
  } else {
    await base44.asServiceRole.entities.TenantSubscription.create(record);
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const rawBody = await req.text();
    const signature = req.headers.get('stripe-signature') || req.headers.get('Stripe-Signature');
    const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    const stripeSecret = getStripeSecretKey();

    if (!endpointSecret || !stripeSecret) {
      return Response.json({ error: 'Missing Stripe webhook configuration' }, { status: 500 });
    }

    const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' });
    let event;

    try {
      event = await stripe.webhooks.constructEventAsync(rawBody, signature, endpointSecret);
    } catch (error) {
      return Response.json({ error: error?.message || 'Invalid signature' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session?.mode === 'subscription' && session?.subscription) {
          const subscription = await stripe.subscriptions.retrieve(typeof session.subscription === 'string' ? session.subscription : session.subscription.id);
          await upsertTenantSubscription(base44, subscription, session?.metadata || {});
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await upsertTenantSubscription(base44, subscription, subscription?.metadata || {});
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        let base44InvoiceId = paymentIntent?.metadata?.base44_invoice_id || paymentIntent?.metadata?.invoice_id || null;
        if (!base44InvoiceId && paymentIntent?.invoice) {
          try {
            const stripeInvoice = await stripe.invoices.retrieve(typeof paymentIntent.invoice === 'string' ? paymentIntent.invoice : paymentIntent.invoice.id);
            base44InvoiceId = stripeInvoice?.metadata?.base44_invoice_id || null;
          } catch (_) {}
        }

        if (base44InvoiceId) {
          const invoiceRecords = await base44.asServiceRole.entities.Invoice.filter({ id: base44InvoiceId }, '-updated_date', 1);
          const currentInvoice = invoiceRecords?.[0] || null;
          if (currentInvoice) {
            const updateData = currentInvoice.status === 'revision'
              ? {
                  payment_reference: paymentIntent.id,
                  stripe_payment_intent_id: paymentIntent.id,
                }
              : {
                  status: 'pagada',
                  payment_date: new Date().toISOString(),
                  payment_method: 'stripe',
                  payment_reference: paymentIntent.id,
                  stripe_payment_intent_id: paymentIntent.id,
                };
            await base44.asServiceRole.entities.Invoice.update(base44InvoiceId, updateData);
          }
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        const invoiceId = paymentIntent?.metadata?.invoice_id || null;
        if (invoiceId) {
          await base44.asServiceRole.entities.Invoice.update(invoiceId, {
            payment_reference: paymentIntent.id,
            stripe_payment_intent_id: paymentIntent.id,
          });
        }
        break;
      }

      case 'invoice.paid': {
        const stripeInvoice = event.data.object;
        const base44InvoiceId = stripeInvoice?.metadata?.base44_invoice_id || null;
        if (base44InvoiceId) {
          const invoiceRecords = await base44.asServiceRole.entities.Invoice.filter({ id: base44InvoiceId }, '-updated_date', 1);
          const currentInvoice = invoiceRecords?.[0] || null;
          if (currentInvoice) {
            const updateData = currentInvoice.status === 'revision'
              ? {
                  payment_reference: stripeInvoice.id,
                  stripe_invoice_id: stripeInvoice.id,
                  stripe_hosted_invoice_url: stripeInvoice.hosted_invoice_url || undefined,
                  stripe_invoice_pdf_url: stripeInvoice.invoice_pdf || undefined,
                  subtotal: (stripeInvoice.subtotal || 0) / 100,
                  tax: (stripeInvoice.tax || 0) / 100,
                  total: (stripeInvoice.total || 0) / 100,
                }
              : {
                  status: 'pagada',
                  payment_date: new Date().toISOString(),
                  payment_method: 'stripe_invoice',
                  payment_reference: stripeInvoice.id,
                  stripe_invoice_id: stripeInvoice.id,
                  stripe_hosted_invoice_url: stripeInvoice.hosted_invoice_url || undefined,
                  stripe_invoice_pdf_url: stripeInvoice.invoice_pdf || undefined,
                  subtotal: (stripeInvoice.subtotal || 0) / 100,
                  tax: (stripeInvoice.tax || 0) / 100,
                  total: (stripeInvoice.total || 0) / 100,
                };
            await base44.asServiceRole.entities.Invoice.update(base44InvoiceId, updateData);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const stripeInvoice = event.data.object;
        const base44InvoiceId = stripeInvoice?.metadata?.base44_invoice_id || null;
        if (base44InvoiceId) {
          await base44.asServiceRole.entities.Invoice.update(base44InvoiceId, {
            payment_reference: stripeInvoice.id,
          });
        }
        break;
      }

      default:
        break;
    }

    return Response.json({ received: true });
  } catch (error) {
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
});