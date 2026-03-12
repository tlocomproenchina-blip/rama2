import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Stripe from 'npm:stripe@14.23.0';

const inFlight = new Set();

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Parse payload first (supports automations)
    let payload = {};
    try {
      payload = await req.json();
    } catch (_) {
      payload = {};
    }

    const isAutomation = !!(payload?.event && payload?.event?.entity_name === 'User');

    // Auth: require user unless it's an automation call
    let authedUser = null;
    try {
      authedUser = await base44.auth.me();
    } catch (_) {
      authedUser = null;
    }

    if (!authedUser && !isAutomation) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const STRIPE_SECRET_KEY =
      Deno.env.get('STRIPE_SECRET_KEY') ||
      Deno.env.get('STRIPEAPI') ||
      Deno.env.get('stripe_secret_key') ||
      Deno.env.get('STRIPE_SK');

    if (!STRIPE_SECRET_KEY) {
      return Response.json({ error: 'Stripe secret key not configured' }, { status: 500 });
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

    const { user_id: targetUserIdFromPayload, force = false } = payload || {};

    // Resolve target user
    let targetUser = null;
    if (isAutomation && payload?.event?.entity_id) {
      const users = await base44.asServiceRole.entities.User.filter({ id: payload.event.entity_id });
      if (!users || users.length === 0) {
        return Response.json({ error: 'Target user not found (automation)' }, { status: 404 });
      }
      targetUser = users[0];
    } else if (targetUserIdFromPayload && authedUser?.role === 'admin') {
      const users = await base44.asServiceRole.entities.User.filter({ id: targetUserIdFromPayload });
      if (!users || users.length === 0) {
        return Response.json({ error: 'Target user not found' }, { status: 404 });
      }
      targetUser = users[0];
    } else {
      // Self
      targetUser = authedUser;
    }

    if (!targetUser) {
      return Response.json({ error: 'Target user not resolved' }, { status: 400 });
    }

    if (targetUser.stripe_customer_id && !force) {
      return Response.json({ success: true, message: 'Stripe customer already exists', stripe_customer_id: targetUser.stripe_customer_id });
    }

    if (!targetUser.email) {
      return Response.json({ error: 'User has no email' }, { status: 400 });
    }

    const inflightKey = `user:${targetUser.id}`;
    if (inFlight.has(inflightKey)) {
      return Response.json({ success: true, message: 'Stripe customer creation in progress' }, { status: 202 });
    }
    inFlight.add(inflightKey);
    try {
      const fullName = targetUser.full_name || `${targetUser.first_name || ''} ${targetUser.last_name || ''}`.trim();

      const customer = await Promise.race([
        stripe.customers.create({
          email: targetUser.email,
          name: fullName || undefined,
          phone: targetUser.phone || targetUser.whatsapp || undefined,
          address: {
            line1: targetUser.address || undefined,
            city: targetUser.city || undefined,
            state: targetUser.state || undefined,
            country: 'VE',
          },
          metadata: {
            base44_user_id: String(targetUser.id || ''),
          },
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Stripe request timeout')), 6000))
      ]);

      // Persist on User (service role to work for both contexts)
      await base44.asServiceRole.entities.User.update(targetUser.id, { stripe_customer_id: customer.id });

      return Response.json({ success: true, stripe_customer_id: customer.id });
    } finally {
      inFlight.delete(inflightKey);
    }
  } catch (error) {
    const message = (error && typeof error === 'object' && 'message' in error) ? error.message : 'Internal Server Error';
    return Response.json({ error: String(message) }, { status: 500 });
  }
});