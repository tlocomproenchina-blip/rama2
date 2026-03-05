import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authed = await base44.auth.me();
    if (!authed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let payload = {};
    try { payload = await req.json(); } catch {}
    const code = String(payload.code || '').trim().toUpperCase();
    if (!code) return Response.json({ error: 'Missing code' }, { status: 400 });

    // If already set, ignore
    if (authed.referred_by_code) {
      return Response.json({ success: true, message: 'Referral already applied', already: true });
    }

    // Find referrer
    const refArr = await base44.asServiceRole.entities.User.filter({ referral_code: code });
    if (!refArr || refArr.length === 0) return Response.json({ error: 'Invalid code' }, { status: 404 });
    const referrer = refArr[0];

    if (referrer.id === authed.id || referrer.email === authed.email) {
      return Response.json({ error: 'Self-referral not allowed' }, { status: 400 });
    }

    // Load app config to get credit amount (optional)
    let amount = 5; // USD default
    try {
      const cfg = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' });
      if (cfg && cfg[0]?.referral_credit_amount) amount = Number(cfg[0].referral_credit_amount) || amount;
    } catch {}

    // Apply credits atomically (best-effort)
    await base44.asServiceRole.entities.User.update(authed.id, {
      referred_by_code: code,
      referral_credit_balance: Number(authed.referral_credit_balance || 0) + amount
    });

    await base44.asServiceRole.entities.User.update(referrer.id, {
      referral_credit_balance: Number(referrer.referral_credit_balance || 0) + amount,
      referral_count: Number(referrer.referral_count || 0) + 1
    });

    // Log events
    try {
      await base44.asServiceRole.entities.ReferralEvent.create({
        referrer_email: referrer.email,
        referee_email: authed.email,
        referral_code: code,
        amount,
        event_type: 'awarded'
      });
    } catch {}

    return Response.json({ success: true, amount, referrer: { email: referrer.email } });
  } catch (error) {
    return Response.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
});