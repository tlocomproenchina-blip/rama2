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
    const stripeSecretKey = getStripeSecretKey();
    if (!stripeSecretKey) {
      return Response.json({ error: 'Stripe secret key not configured' }, { status: 500 });
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' });
    const tenantSubscriptions = await base44.asServiceRole.entities.TenantSubscription.filter({ tenant_id: tenantId }, '-updated_date', 20);
    const currentSubscription = (tenantSubscriptions || []).find((item) => item.stripe_customer_id && ['active', 'trialing', 'past_due', 'incomplete'].includes(item.status)) || tenantSubscriptions?.[0] || null;
    if (!currentSubscription?.stripe_customer_id) {
      return Response.json({ error: 'No Stripe customer found for this tenant' }, { status: 404 });
    }

    const returnUrl = payload?.return_url || `${resolveOrigin(req, payload?.app_base_url)}/AdminBilling`;
    const session = await stripe.billingPortal.sessions.create({
      customer: currentSubscription.stripe_customer_id,
      return_url: returnUrl,
    });

    return Response.json({ success: true, url: session.url });
  } catch (error) {
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
});