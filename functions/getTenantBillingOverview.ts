import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Stripe from 'npm:stripe@14.23.0';

function getStripeSecretKey() {
  return Deno.env.get('STRIPE_SECRET_KEY') || Deno.env.get('CLAVESECRETA') || Deno.env.get('STRIPEAPI') || null;
}

function resolveTenantId(user, payload = {}) {
  return payload?.tenant_id || user?.tenant_id || 'main';
}

function getBasePlans() {
  return [
    {
      plan_code: 'free_trial_14d',
      name: 'Prueba gratis 14 días',
      description: 'Activa una prueba gratuita de 14 días antes de contratar un plan pago.',
      billing_cycle: 'trial',
      duration_months: 0,
      price: 0,
      original_price: 0,
      discount_percentage: 0,
      monthly_equivalent: 0,
      currency: 'usd',
      is_trial: true,
      trial_days: 14,
      stripe_lookup_key: 'saas_free_trial_14d',
      features: ['14 días gratis', 'Sin pago inicial', 'Cambio a plan pago cuando decidas'],
      is_active: true,
      display_order: 0,
    },
    {
      plan_code: 'monthly_100',
      name: 'Plan mensual',
      description: 'Pago flexible mes a mes para iniciar rápidamente.',
      billing_cycle: 'monthly',
      duration_months: 1,
      price: 100,
      original_price: 100,
      discount_percentage: 0,
      monthly_equivalent: 100,
      currency: 'usd',
      is_trial: false,
      trial_days: 0,
      stripe_lookup_key: 'saas_monthly_100',
      features: ['$100/mes', 'Sin descuento', 'Ideal para probar'],
      is_active: true,
      display_order: 1,
    },
    {
      plan_code: 'quarterly_270',
      name: 'Plan trimestral',
      description: 'Pago único de 3 meses con 10% de descuento.',
      billing_cycle: 'quarterly',
      duration_months: 3,
      price: 270,
      original_price: 300,
      discount_percentage: 10,
      monthly_equivalent: 90,
      currency: 'usd',
      is_trial: false,
      trial_days: 0,
      stripe_lookup_key: 'saas_quarterly_270',
      features: ['$270 por 3 meses', '10% de descuento', 'Equivale a $90/mes'],
      is_active: true,
      display_order: 2,
    },
    {
      plan_code: 'semiannual_510',
      name: 'Plan semestral',
      description: 'Pago único de 6 meses con 15% de descuento.',
      billing_cycle: 'semiannual',
      duration_months: 6,
      price: 510,
      original_price: 600,
      discount_percentage: 15,
      monthly_equivalent: 85,
      currency: 'usd',
      is_trial: false,
      trial_days: 0,
      stripe_lookup_key: 'saas_semiannual_510',
      features: ['$510 por 6 meses', '15% de descuento', 'Equivale a $85/mes'],
      is_active: true,
      display_order: 3,
    },
    {
      plan_code: 'annual_960',
      name: 'Plan anual',
      description: 'Pago anual con el mejor ahorro disponible.',
      billing_cycle: 'annual',
      duration_months: 12,
      price: 960,
      original_price: 1200,
      discount_percentage: 20,
      monthly_equivalent: 80,
      currency: 'usd',
      is_trial: false,
      trial_days: 0,
      stripe_lookup_key: 'saas_annual_960',
      features: ['$960 por 12 meses', '20% de descuento', 'Equivale a $80/mes'],
      is_active: true,
      display_order: 4,
    }
  ];
}

async function ensureStripePlan(stripe, plan) {
  if (plan.is_trial) {
    return { stripe_product_id: plan.stripe_product_id || null, stripe_price_id: null };
  }

  let productId = plan.stripe_product_id || null;
  let priceId = plan.stripe_price_id || null;
  let product = null;

  if (productId) {
    try {
      product = await stripe.products.retrieve(productId);
    } catch (_) {
      product = null;
    }
  }

  if (!product) {
    product = await stripe.products.create({
      name: plan.name,
      description: plan.description,
      metadata: {
        plan_code: plan.plan_code,
        billing_cycle: plan.billing_cycle,
      },
    });
    productId = product.id;
  }

  let needsNewPrice = true;
  if (priceId) {
    try {
      const existingPrice = await stripe.prices.retrieve(priceId);
      needsNewPrice = !(
        existingPrice.active &&
        existingPrice.unit_amount === Math.round(Number(plan.price || 0) * 100) &&
        existingPrice.currency === String(plan.currency || 'usd').toLowerCase() &&
        existingPrice.recurring?.interval === 'month' &&
        Number(existingPrice.recurring?.interval_count || 0) === Number(plan.duration_months || 0)
      );
    } catch (_) {
      needsNewPrice = true;
    }
  }

  if (needsNewPrice) {
    const createdPrice = await stripe.prices.create({
      product: productId,
      unit_amount: Math.round(Number(plan.price || 0) * 100),
      currency: String(plan.currency || 'usd').toLowerCase(),
      recurring: {
        interval: 'month',
        interval_count: Number(plan.duration_months || 1),
      },
      lookup_key: plan.stripe_lookup_key || undefined,
      metadata: {
        plan_code: plan.plan_code,
      },
    });
    priceId = createdPrice.id;
  }

  return { stripe_product_id: productId, stripe_price_id: priceId };
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
    const stripeSecretKey = getStripeSecretKey();
    const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' }) : null;

    const defaults = getBasePlans();
    const existingPlans = await base44.asServiceRole.entities.SubscriptionPlan.list('-display_order', 50);

    for (const plan of defaults) {
      const found = (existingPlans || []).find((item) => item.plan_code === plan.plan_code);
      let stripeData = {
        stripe_product_id: found?.stripe_product_id || null,
        stripe_price_id: found?.stripe_price_id || null,
      };

      if (stripe && !plan.is_trial) {
        stripeData = await ensureStripePlan(stripe, { ...plan, ...stripeData });
      }

      const nextData = { ...plan, ...stripeData };
      if (found) {
        await base44.asServiceRole.entities.SubscriptionPlan.update(found.id, nextData);
      } else {
        await base44.asServiceRole.entities.SubscriptionPlan.create(nextData);
      }
    }

    const plans = await base44.asServiceRole.entities.SubscriptionPlan.list('display_order', 50);
    const tenantSubscriptions = await base44.asServiceRole.entities.TenantSubscription.filter({ tenant_id: tenantId }, '-updated_date', 20);
    const currentSubscription = (tenantSubscriptions || []).find((item) => ['trialing', 'active', 'past_due', 'incomplete'].includes(item.status)) || tenantSubscriptions?.[0] || null;
    const hadTrial = (tenantSubscriptions || []).some((item) => item.plan_code === 'free_trial_14d');

    return Response.json({
      tenant_id: tenantId,
      plans,
      current_subscription: currentSubscription,
      can_start_trial: !hadTrial,
      billing_email: user.email,
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
});