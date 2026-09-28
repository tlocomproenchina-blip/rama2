import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@14.23.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    let payload = {};
    try {
      payload = await req.json();
    } catch (_) {
      payload = {};
    }

    const { user_id, stripe_customer_id } = payload || {};

    const STRIPE_SECRET_KEY =
      Deno.env.get('STRIPE_SECRET_KEY') ||
      Deno.env.get('STRIPEAPI') ||
      Deno.env.get('stripe_secret_key') ||
      Deno.env.get('STRIPE_SK');

    if (!STRIPE_SECRET_KEY) {
      return Response.json({ error: 'Stripe secret key not configured' }, { status: 500 });
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

    let customerId = stripe_customer_id || null;
    let targetUser = null;

    if (user_id) {
      const users = await base44.asServiceRole.entities.User.filter({ id: user_id });
      if (!users || users.length === 0) {
        return Response.json({ error: 'User not found' }, { status: 404 });
      }
      targetUser = users[0];
      customerId = customerId || targetUser.stripe_customer_id;
    }

    if (!customerId) {
      return Response.json({ error: 'No Stripe customer id provided/found' }, { status: 400 });
    }

    const deleted = await stripe.customers.del(customerId);

    // Clear field on user if known
    if (targetUser?.id) {
      await base44.asServiceRole.entities.User.update(targetUser.id, { stripe_customer_id: '' });
    } else {
      // Try best-effort lookup by stripe_customer_id
      if (!user_id) {
        const users = await base44.asServiceRole.entities.User.filter({ stripe_customer_id: customerId });
        if (users && users.length > 0) {
          await base44.asServiceRole.entities.User.update(users[0].id, { stripe_customer_id: '' });
        }
      }
    }

    return Response.json({ success: true, deleted_id: deleted.id });
  } catch (error) {
    const message = (error && typeof error === 'object' && 'message' in error) ? error.message : 'Internal Server Error';
    return Response.json({ error: String(message) }, { status: 500 });
  }
});