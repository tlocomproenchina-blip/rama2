import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Stripe from 'npm:stripe@14.23.0';

function getStripeSecretKey() {
  return Deno.env.get('STRIPE_SECRET_KEY') || Deno.env.get('CLAVESECRETA') || Deno.env.get('STRIPEAPI') || null;
}

function resolveTenantId(user, payload = {}) {
  return payload?.tenant_id || user?.tenant_id || 'main';
}

function resolveOrigin(req, fallback = '') {
  return req.headers.get('origin') || fallback || 'https://example.com';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const payload = await req.json().catch(() => ({}));
    const tenantId = resolveTenantId(user, payload);
    const planCode = payload?.plan_code;
    if (!planCode) {
      return Response.json({ error: 'plan_code is required' }, { status: 400 });
    }

    const stripeSecretKey = getStripeSecretKey();
    if (!stripeSecretKey) {
      return Response.json({ error: 'Stripe secret key not configured' }, { status: 500 });
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' });
    const planMatches = await base44.asServiceRole.entities.SubscriptionPlan.filter({ plan_code: planCode, is_active: true }, '-updated_date', 1);
    const plan = planMatches?.[0];
    if (!plan || plan.is_trial || !plan.stripe_price_id) {
      return Response.json({ error: 'Selected plan is not available for checkout' }, { status: 400 });
    }

    const existingSubs = await base44.asServiceRole.entities.TenantSubscription.filter({ tenant_id: tenantId }, '-updated_date', 20);
    const activeSub = (existingSubs || []).find((item) => item.stripe_subscription_id && ['active', 'trialing', 'past_due'].includes(item.status));
    if (activeSub) {
      return Response.json({ error: 'An active Stripe subscription already exists for this tenant' }, { status: 400 });
    }

    let stripeCustomerId = (existingSubs || []).find((item) => item.stripe_customer_id)?.stripe_customer_id || null;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.full_name || user.email,
        metadata: {
          tenant_id: tenantId,
          admin_user_id: user.id,
        },
      });
      stripeCustomerId = customer.id;
    }

    const origin = resolveOrigin(req, payload?.app_base_url);
    const successUrl = payload?.success_url || `${origin}/AdminBilling?billing=success`;
    const cancelUrl = payload?.cancel_url || `${origin}/AdminBilling?billing=cancel`;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      metadata: {
        tenant_id: tenantId,
        plan_code: plan.plan_code,
        billing_email: user.email,
      },
      subscription_data: {
        metadata: {
          tenant_id: tenantId,
          plan_code: plan.plan_code,
          billing_email: user.email,
        },
      },
    });

    await base44.asServiceRole.entities.TenantSubscription.create({
      tenant_id: tenantId,
      plan_code: plan.plan_code,
      plan_name: plan.name,
      status: 'incomplete',
      billing_cycle: plan.billing_cycle,
      amount: plan.price,
      currency: plan.currency || 'usd',
      billing_email: user.email,
      stripe_customer_id: stripeCustomerId,
      stripe_product_id: plan.stripe_product_id,
      stripe_price_id: plan.stripe_price_id,
      stripe_checkout_session_id: session.id,
      notes: 'Checkout de suscripción iniciado desde el panel administrativo.',
    });

    return Response.json({ success: true, url: session.url, session_id: session.id });
  } catch (error) {
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
});