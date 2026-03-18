import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Stripe from 'npm:stripe@14.25.0';

function getStripeSecretKey() {
  return Deno.env.get('STRIPE_SECRET_KEY') || Deno.env.get('CLAVESECRETA') || Deno.env.get('STRIPEAPI') || null;
}

function getCatalogDefinition() {
  return {
    plan_code: 'base',
    name: 'Plan Base',
    description: 'Estructura recomendada con descuentos por permanencia',
    features: [
      'Pago flexible mensual',
      '10% de descuento trimestral',
      '15% de descuento semestral',
      '20% de descuento anual'
    ],
    max_users: 10,
    max_shipments_per_month: 1000,
    sort_order: 1,
    is_active: true,
    prices: [
      { billing_cycle: 'monthly', unit_amount: 10000, interval: 'month', interval_count: 1, field: 'stripe_price_id_monthly' },
      { billing_cycle: 'quarterly', unit_amount: 27000, interval: 'month', interval_count: 3, field: 'stripe_price_id_quarterly' },
      { billing_cycle: 'semiannual', unit_amount: 51000, interval: 'month', interval_count: 6, field: 'stripe_price_id_semiannual' },
      { billing_cycle: 'yearly', unit_amount: 96000, interval: 'year', interval_count: 1, field: 'stripe_price_id_yearly' }
    ]
  };
}

function findMatchingPrice(prices, cfg) {
  return (prices || []).find((price) => {
    const recurring = price.recurring || {};
    return price.unit_amount === cfg.unit_amount && recurring.interval === cfg.interval && Number(recurring.interval_count || 1) === Number(cfg.interval_count || 1);
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const stripeSecretKey = getStripeSecretKey();
    if (!stripeSecretKey) {
      return Response.json({ error: 'Stripe secret key not configured' }, { status: 500 });
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' });
    const catalog = getCatalogDefinition();

    const products = await stripe.products.list({ active: true, limit: 100 });
    let product = products.data.find((item) => item.metadata?.base44_plan_code === catalog.plan_code);

    if (!product) {
      product = await stripe.products.create({
        name: catalog.name,
        description: catalog.description,
        metadata: {
          base44_plan_code: catalog.plan_code,
          base44_catalog_type: 'saas_plan'
        }
      });
    }

    const existingPrices = await stripe.prices.list({ product: product.id, active: true, limit: 100 });
    const priceFields = {};
    const createdPrices = [];

    for (const cfg of catalog.prices) {
      let price = findMatchingPrice(existingPrices.data, cfg);

      if (!price) {
        price = await stripe.prices.create({
          product: product.id,
          unit_amount: cfg.unit_amount,
          currency: 'usd',
          recurring: {
            interval: cfg.interval,
            interval_count: cfg.interval_count
          },
          nickname: `${catalog.name} - ${cfg.billing_cycle}`,
          metadata: {
            base44_plan_code: catalog.plan_code,
            billing_cycle: cfg.billing_cycle
          }
        });
        createdPrices.push({ billing_cycle: cfg.billing_cycle, price_id: price.id });
      }

      priceFields[cfg.field] = price.id;
    }

    const payload = {
      plan_code: catalog.plan_code,
      name: catalog.name,
      description: catalog.description,
      monthly_price: 100,
      quarterly_price: 270,
      semiannual_price: 510,
      yearly_price: 960,
      currency: 'usd',
      ...priceFields,
      features: catalog.features,
      max_users: catalog.max_users,
      max_shipments_per_month: catalog.max_shipments_per_month,
      sort_order: catalog.sort_order,
      is_active: catalog.is_active
    };

    const existingPlans = await base44.asServiceRole.entities.SubscriptionPlan.filter({ plan_code: catalog.plan_code });
    if (existingPlans?.[0]) {
      await base44.asServiceRole.entities.SubscriptionPlan.update(existingPlans[0].id, payload);
    } else {
      await base44.asServiceRole.entities.SubscriptionPlan.create(payload);
    }

    return Response.json({
      success: true,
      product_id: product.id,
      created_prices: createdPrices,
      subscription_plan: payload
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
});