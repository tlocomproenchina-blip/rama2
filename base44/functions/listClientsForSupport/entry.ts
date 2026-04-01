import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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

    // Paginate to fetch all users with role=user
    const PAGE_SIZE = 50;
    let allUsers = [];
    let skip = 0;
    let batch = [];

    do {
      console.log(`[Batch ${skip / PAGE_SIZE}] Fetching skip=${skip}, limit=${PAGE_SIZE}`);
      batch = await base44.asServiceRole.entities.User.filter({ role: 'user' }, '-created_date', PAGE_SIZE, skip);
      console.log(`[Batch ${skip / PAGE_SIZE}] Received ${batch.length} records`);
      allUsers = allUsers.concat(batch);
      console.log(`[Batch ${skip / PAGE_SIZE}] Running total: ${allUsers.length}`);
      skip += PAGE_SIZE;
    } while (batch.length === PAGE_SIZE);

    console.log(`Total users fetched: ${allUsers.length}`);
    console.log(`Clients with role=user: ${allUsers.filter(u => u.role === 'user').length}`);

    const sanitized = allUsers.map((u) => ({
      id: u.id,
      email: u.email,
      full_name: u.full_name || null,
      first_name: u.first_name || null,
      last_name: u.last_name || null,
      state: u.state || null,
      city: u.city || null,
      address: u.address || null,
      whatsapp: u.whatsapp || null,
      phone: u.phone || null,
      shipping_mark: u.shipping_mark || null,
      profile_completed: !!u.profile_completed,
      is_active: u.is_active !== false,
      stripe_customer_id: u.stripe_customer_id || null,
      created_date: u.created_date,
    }));

    return Response.json(sanitized);
  } catch (error) {
    console.error('Error in listClientsForSupport:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});