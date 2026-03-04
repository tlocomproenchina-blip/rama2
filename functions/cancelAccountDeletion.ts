import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await base44.auth.updateMe({
      deletion_requested: false,
      deletion_requested_at: null,
      deletion_reason: null,
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
});