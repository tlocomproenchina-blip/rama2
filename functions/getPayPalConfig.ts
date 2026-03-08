import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const clientId = Deno.env.get('PAYPAL_CLIENT_ID');
    if (!clientId) return Response.json({ error: 'PAYPAL_CLIENT_ID no configurado' }, { status: 500 });

    return Response.json({ clientId, currency: 'USD', intent: 'capture' });
  } catch (e) {
    return Response.json({ error: e.message || 'Error interno' }, { status: 500 });
  }
});