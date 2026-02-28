import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Load all users with role 'user'
    const allUsers = await base44.asServiceRole.entities.User.filter({ role: 'user' });

    let created = 0;
    let skipped = 0;
    let failed = 0;
    const errors: Array<{email: string; error: string}> = [];

    for (const u of allUsers) {
      if (u.stripe_customer_id) { skipped++; continue; }
      try {
        await base44.asServiceRole.functions.invoke('createStripeCustomer', { user_id: u.id });
        created++;
      } catch (e) {
        failed++;
        errors.push({ email: u.email, error: (e as Error)?.message || 'unknown error' });
      }
    }

    return Response.json({ success: true, created, skipped, failed, errors });
  } catch (error) {
    const message = (error && typeof error === 'object' && 'message' in error) ? (error as any).message : 'Internal Server Error';
    return Response.json({ error: String(message) }, { status: 500 });
  }
});