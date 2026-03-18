import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

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

    const plans = await base44.asServiceRole.entities.SubscriptionPlan.filter({ plan_code: 'free_trial_14d' }, '-updated_date', 1);
    const trialPlan = plans?.[0] || {
      plan_code: 'free_trial_14d',
      name: 'Prueba gratis 14 días',
      trial_days: 14,
    };

    const existingSubs = await base44.asServiceRole.entities.TenantSubscription.filter({ tenant_id: tenantId }, '-updated_date', 20);
    const hadTrial = (existingSubs || []).some((item) => item.plan_code === 'free_trial_14d');
    if (hadTrial) {
      return Response.json({ error: 'This tenant already used the free trial' }, { status: 400 });
    }

    const activeSub = (existingSubs || []).find((item) => ['trialing', 'active', 'past_due', 'incomplete'].includes(item.status));
    if (activeSub) {
      return Response.json({ error: 'This tenant already has an active subscription record' }, { status: 400 });
    }

    const now = new Date();
    const trialEnd = new Date(now.getTime() + Number(trialPlan.trial_days || 14) * 24 * 60 * 60 * 1000);

    const created = await base44.asServiceRole.entities.TenantSubscription.create({
      tenant_id: tenantId,
      plan_code: trialPlan.plan_code,
      plan_name: trialPlan.name,
      status: 'trialing',
      billing_cycle: 'trial',
      amount: 0,
      currency: 'usd',
      billing_email: user.email,
      trial_start: now.toISOString(),
      trial_end: trialEnd.toISOString(),
      current_period_start: now.toISOString(),
      current_period_end: trialEnd.toISOString(),
      notes: 'Prueba gratuita iniciada desde el panel administrativo.',
    });

    return Response.json({ success: true, subscription: created });
  } catch (error) {
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
});