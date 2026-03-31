import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { code } = await req.json();
    if (!code) return Response.json({ error: 'Missing code' }, { status: 400 });

    // If already referred, do nothing (idempotent)
    if (me.referred_by_user_id) {
      return Response.json({ skipped: true, reason: 'already referred' });
    }

    const clean = String(code).trim().toUpperCase();
    const rows = await base44.asServiceRole.entities.User.filter({ referral_code: clean });
    const referrer = rows[0];
    if (!referrer) return Response.json({ error: 'Invalid code' }, { status: 404 });

    if (referrer.id === me.id || referrer.email === me.email) {
      return Response.json({ error: 'Self-referral not allowed' }, { status: 400 });
    }

    await base44.asServiceRole.entities.User.update(me.id, {
      referred_by_user_id: referrer.id,
      referral_joined_at: new Date().toISOString()
    });

    return Response.json({ success: true, referrer_id: referrer.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});