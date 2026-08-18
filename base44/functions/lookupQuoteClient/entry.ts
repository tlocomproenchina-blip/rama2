import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();

    if (!email || !email.includes('@')) {
      return Response.json({ found: false, shipping_mark: null, full_name: null });
    }

    // Buscar usuario por email exacto
    const users = await base44.asServiceRole.entities.User.filter({ email }, '-created_date', 5);

    if (!users.length) {
      return Response.json({ found: false, shipping_mark: null, full_name: null });
    }

    const u = users[0];
    return Response.json({
      found: true,
      shipping_mark: u.shipping_mark || null,
      full_name: u.full_name || null,
      is_active: u.is_active !== false
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}