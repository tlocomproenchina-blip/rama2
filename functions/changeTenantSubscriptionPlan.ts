import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Stripe from 'npm:stripe@14.23.0';

function getStripeSecretKey() {
  return Deno.env.get('STRIPE_SECRET_KEY') || Deno.env.get('CLAVESECRETA') || Deno.env.get('STRIPEAPI') || null;
}

function resolveTenantId(user, payload = {}) {
  return payload?.tenant_id || user?.tenant_id || 'main';
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
      return Response.json({ error: 'Selected plan is not available for plan changes' }, { status: 400 });
    }

    const tenantSubscriptions = await base44.asServiceRole.entities.TenantSubscription.filter({ tenant_id: tenantId }, '-updated_date', 20);
    const currentSubscription = (tenantSubscriptions || []).find((item) => item.stripe_subscription_id && ['active', 'trialing', 'past_due'].includes(item.status));
    if (!currentSubscription?.stripe_subscription_id) {
      return Response.json({ requires_checkout: true, message: 'No active Stripe subscription found for this tenant' }, { status: 400 });
    }

    const stripeSubscription = await stripe.subscriptions.retrieve(currentSubscription.stripe_subscription_id);
    const itemId = stripeSubscription.items?.data?.[0]?.id;
    if (!itemId) {
      return Response.json({ error: 'Stripe subscription item not found' }, { status: 400 });
    }

    const updated = await stripe.subscriptions.update(currentSubscription.stripe_subscription_id, {
      cancel_at_period_end: false,
      proration_behavior: 'create_prorations',
      items: [{ id: itemId, price: plan.stripe_price_id }],
      metadata: {
        tenant_id: tenantId,
        plan_code: plan.plan_code,
        billing_email: user.email,
      },
    });

    const nextData = {
      plan_code: plan.plan_code,
      plan_name: plan.name,
      status: updated.status,
      billing_cycle: plan.billing_cycle,
      amount: plan.price,
      currency: plan.currency || 'usd',
      billing_email: user.email,
      stripe_product_id: plan.stripe_product_id,
      stripe_price_id: plan.stripe_price_id,
      current_period_start: updated.current_period_start ? new Date(updated.current_period_start * 1000).toISOString() : currentSubscription.current_period_start,
      current_period_end: updated.current_period_end ? new Date(updated.current_period_end * 1000).toISOString() : currentSubscription.current_period_end,
      cancel_at_period_end: !!updated.cancel_at_period_end,
      notes: `Plan cambiado manualmente a ${plan.name}`,
    };

    await base44.asServiceRole.entities.TenantSubscription.update(currentSubscription.id, nextData);

    return Response.json({ success: true, subscription: { ...currentSubscription, ...nextData } });
  } catch (error) {
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
});