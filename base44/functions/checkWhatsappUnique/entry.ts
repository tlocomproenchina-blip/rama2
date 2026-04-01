import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function normalizeDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

async function fetchAllUsers(base44) {
  let all = [];
  let skip = 0;
  const batchSize = 50;
  for (let i = 0; i < 100; i++) {
    const batch = await base44.asServiceRole.entities.User.filter(
      { role: 'user' }, '-created_date', batchSize, skip
    );
    if (!batch || batch.length === 0) break;
    all = all.concat(batch);
    skip += batch.length;
    if (batch.length < batchSize) break;
  }
  return all;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let payload = {};
    try { payload = await req.json(); } catch (_) {}

    const whatsapp = payload?.whatsapp || '';
    const currentUserId = payload?.current_user_id || null;
    const inputDigits = normalizeDigits(whatsapp);

    if (!inputDigits || inputDigits.length < 6) {
      return Response.json({ unique: true, count: 0 });
    }

    // Fetch ALL users and compare digits from both whatsapp and whatsapp_normalized
    const allUsers = await fetchAllUsers(base44);

    const others = allUsers.filter(u => {
      if (currentUserId && u.id === currentUserId) return false;
      const normalizedField = normalizeDigits(u.whatsapp_normalized);
      const rawField = normalizeDigits(u.whatsapp);
      return normalizedField === inputDigits || rawField === inputDigits;
    });

    return Response.json({
      unique: others.length === 0,
      count: others.length,
      matches: others.map(u => ({
        email: u.email,
        full_name: u.full_name,
        whatsapp: u.whatsapp
      }))
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
});