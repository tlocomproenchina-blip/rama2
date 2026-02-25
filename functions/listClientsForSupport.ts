import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allowed = user.role === 'admin' || user.custom_role === 'customer_service';
    if (!allowed) {
      return Response.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 });
    }

    const allUsers = await base44.asServiceRole.entities.User.filter({ role: 'user' });

    const sanitized = allUsers.map((u) => ({
      id: u.id,
      email: u.email,
      first_name: u.first_name || null,
      last_name: u.last_name || null,
      state: u.state || null,
      city: u.city || null,
      address: u.address || null,
      whatsapp: u.whatsapp || null,
      phone: u.phone || null,
      shipping_mark: u.shipping_mark || null,
      profile_completed: !!u.profile_completed,
      created_date: u.created_date,
    }));

    return Response.json(sanitized);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});