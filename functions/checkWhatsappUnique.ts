import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function normalizeDigits(value) {
  try {
    return String(value || '').replace(/\D/g, '');
  } catch (_) {
    return '';
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Must be authenticated
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse payload
    let payload = {};
    try {
      payload = await req.json();
    } catch (_) {
      // no body provided
    }

    const whatsapp = payload?.whatsapp || '';
    const currentUserId = payload?.current_user_id || null;
    const digits = normalizeDigits(whatsapp);

    if (!digits) {
      // No whatsapp provided -> consider as unique (validation should catch empty on client)
      return Response.json({ unique: true, count: 0 });
    }

    // Use service role to search other users (end users cannot list all users)
    const matches = await base44.asServiceRole.entities.User.filter({ whatsapp_normalized: digits });

    // Exclude current user if provided
    const others = (matches || []).filter((u) => u.id !== currentUserId);

    return Response.json({ unique: others.length === 0, count: others.length });
  } catch (error) {
    return Response.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
});