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

    // Paginate through ALL users using list() with explicit skip
    let allUsers = [];
    let skip = 0;
    const batchSize = 50; // Use smaller batches for reliability
    const maxIterations = 100; // Safety limit

    for (let i = 0; i < maxIterations; i++) {
      console.log(`[Batch ${i}] Fetching skip=${skip}, limit=${batchSize}`);
      const batch = await base44.asServiceRole.entities.User.list(
        '-created_date',
        batchSize,
        skip
      );
      
      const batchLen = Array.isArray(batch) ? batch.length : 0;
      console.log(`[Batch ${i}] Received ${batchLen} records`);
      
      if (!Array.isArray(batch) || batch.length === 0) {
        console.log(`[Batch ${i}] Empty batch, stopping pagination`);
        break;
      }
      
      allUsers = allUsers.concat(batch);
      console.log(`[Batch ${i}] Running total: ${allUsers.length}`);
      
      if (batch.length < batchSize) {
        console.log(`[Batch ${i}] Partial batch (${batch.length} < ${batchSize}), stopping`);
        break;
      }
      
      skip += batchSize;
    }

    console.log(`Total users fetched: ${allUsers.length}`);

    // Filter to only regular users with valid id/email
    const clients = allUsers.filter((u) => u && u.id && u.email && u.role === 'user');
    console.log(`Clients with role=user: ${clients.length}`);

    const sanitized = clients.map((u) => ({
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
    console.error('listClientsForSupport error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});