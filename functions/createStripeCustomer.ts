import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@14.23.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authedUser = await base44.auth.me();
    if (!authedUser) {
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

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20',
    });

    let payload: any = {};
    try {
      payload = await req.json();
    } catch (_) {
      payload = {};
    }

    const { user_id: targetUserId, force = false } = payload || {};

    // Resolve target user: self by default, or specific user if admin
    let targetUser: any = authedUser;
    if (targetUserId && authedUser?.role === 'admin') {
      const users = await base44.asServiceRole.entities.User.filter({ id: targetUserId });
      if (!users || users.length === 0) {
        return Response.json({ error: 'Target user not found' }, { status: 404 });
      }
      targetUser = users[0];
    } else if (targetUserId && authedUser?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required to create Stripe customer for another user' }, { status: 403 });
    }

    if (targetUser.stripe_customer_id && !force) {
      return Response.json({
        success: true,
        message: 'Stripe customer already exists',
        stripe_customer_id: targetUser.stripe_customer_id,
      });
    }

    const fullName = targetUser.full_name || `${targetUser.first_name || ''} ${targetUser.last_name || ''}`.trim();

    const customer = await stripe.customers.create({
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
    });

    // Persist on User entity
    if (targetUser.id) {
      if (authedUser.id === targetUser.id) {
        // The authenticated user updates self via auth.updateMe
        await base44.auth.updateMe({ stripe_customer_id: customer.id });
      } else {
        // Admin updates another user via service role
        await base44.asServiceRole.entities.User.update(targetUser.id, { stripe_customer_id: customer.id });
      }
    }

    return Response.json({ success: true, stripe_customer_id: customer.id });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
});