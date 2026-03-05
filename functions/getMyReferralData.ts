import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all needed data in parallel with service role but strictly scoped to the current user
    const [rawReferred, rewards, credits] = await Promise.all([
      base44.asServiceRole.entities.User.filter({ referred_by_user_id: user.id }, '-created_date', 200),
      base44.asServiceRole.entities.ReferralCbmReward.filter({ referrer_user_id: user.id }, '-created_date', 200),
      base44.asServiceRole.entities.CreditsLedger.filter({ user_id: user.id }, '-created_date', 200)
    ]);

    // Return a safe subset of referred users' fields
    const referredUsers = (rawReferred || []).map(u => ({
      id: u.id,
      email: u.email,
      full_name: u.full_name,
      first_name: u.first_name,
      last_name: u.last_name,
      referral_joined_at: u.referral_joined_at,
      created_date: u.created_date,
    }));

    return Response.json({
      referredUsers,
      rewards: rewards || [],
      credits: credits || [],
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});