import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Stripe from 'npm:stripe@14.25.0';

function getStripeSecretKey() {
  return Deno.env.get('STRIPE_SECRET_KEY') || Deno.env.get('CLAVESECRETA') || Deno.env.get('STRIPEAPI') || null;
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
    const returnUrl = payload?.returnUrl || req.headers.get('origin') || user?.appBaseUrl || '';

    if (!tenantId || !returnUrl) {
      return Response.json({ error: 'Missing tenant or return URL' }, { status: 400 });
    }

    const stripeSecretKey = getStripeSecretKey();
    if (!stripeSecretKey) {
      return Response.json({ error: 'Stripe secret key not configured' }, { status: 500 });
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' });
    const tenantRows = await base44.asServiceRole.entities.Tenant.filter({ id: tenantId });
    const tenant = tenantRows?.[0];

    if (!tenant?.stripe_customer_id) {
      return Response.json({ error: 'Tenant has no Stripe customer yet' }, { status: 400 });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripe_customer_id,
      return_url: returnUrl
    });

    return Response.json({ url: session.url });
  } catch (error) {
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
});