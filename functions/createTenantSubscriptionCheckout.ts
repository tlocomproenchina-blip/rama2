import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Stripe from 'npm:stripe@14.25.0';

function getStripeSecretKey() {
  return Deno.env.get('STRIPE_SECRET_KEY') || Deno.env.get('CLAVESECRETA') || Deno.env.get('STRIPEAPI') || null;
}

async function resolveTenant(base44, tenantId) {
  if (tenantId && tenantId !== 'legacy-default') {
    const rows = await base44.asServiceRole.entities.Tenant.filter({ id: tenantId });
    if (rows?.[0]) return rows[0];
  }

  const defaultRows = await base44.asServiceRole.entities.Tenant.filter({ is_default: true });
  if (defaultRows?.[0]) return defaultRows[0];

  const legacyRows = await base44.asServiceRole.entities.Tenant.filter({ slug: 'tlec-cargo' });
  return legacyRows?.[0] || null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    let payload = {};
    try {
      payload = await req.json();
    } catch (_) {
      payload = {};
    }
    const tenantId = payload?.tenant_id || user?.tenant_id;
    const planCode = payload?.planCode;
    const planName = payload?.planName || 'Plan SaaS';
    const priceId = payload?.priceId;
    const billingCycle = payload?.billingCycle === 'yearly' ? 'yearly' : 'monthly';
    const returnUrl = payload?.returnUrl || req.headers.get('origin') || user?.appBaseUrl || '';

    if (!tenantId || !planCode || !priceId || !returnUrl) {
      return Response.json({ error: 'Missing tenant, plan, price or return URL' }, { status: 400 });
    }

    const stripeSecretKey = getStripeSecretKey();
    if (!stripeSecretKey) {
      return Response.json({ error: 'Stripe secret key not configured' }, { status: 500 });
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' });

    const tenant = await resolveTenant(base44, tenantId);

    if (!tenant) {
      return Response.json({ error: 'Tenant not found' }, { status: 404 });
    }

    let stripeCustomerId = tenant.stripe_customer_id;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        name: tenant.name,
        email: tenant.owner_email || undefined,
        metadata: {
          base44_tenant_id: String(tenant.id),
          tenant_slug: String(tenant.slug || ''),
          tenant_name: String(tenant.name || '')
        }
      });
      stripeCustomerId = customer.id;
      await base44.asServiceRole.entities.Tenant.update(tenant.id, { stripe_customer_id: stripeCustomerId });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      success_url: `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}billing=success`,
      cancel_url: `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}billing=cancelled`,
      allow_promotion_codes: true,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        tenant_id: String(tenant.id),
        plan_code: String(planCode),
        plan_name: String(planName),
        billing_cycle: billingCycle
      },
      subscription_data: {
        metadata: {
          tenant_id: String(tenant.id),
          plan_code: String(planCode),
          plan_name: String(planName),
          billing_cycle: billingCycle
        }
      }
    });

    return Response.json({ url: session.url });
  } catch (error) {
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
});