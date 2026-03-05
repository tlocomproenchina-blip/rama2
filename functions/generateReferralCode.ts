import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function makeCode(seed) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  crypto.getRandomValues(new Uint8Array(8)).forEach((n, i) => {
    out += alphabet[(n + (seed?.charCodeAt(i % seed.length) || 0)) % alphabet.length];
  });
  return out;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // If already has code, return it
    if (user.referral_code && user.referral_code.length >= 6) {
      return Response.json({ code: user.referral_code });
    }

    // Generate unique code
    let code = '';
    let attempts = 0;
    while (attempts < 10) {
      code = makeCode(String(user.id || user.email)).slice(0, 8);
      const existing = await base44.asServiceRole.entities.User.filter({ referral_code: code });
      if (!existing || existing.length === 0) break;
      attempts++;
    }
    if (!code) code = makeCode('fallback').slice(0, 8);

    await base44.asServiceRole.entities.User.update(user.id, { referral_code: code });
    return Response.json({ code });
  } catch (error) {
    return Response.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
});