import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const apiKey = req.headers.get('x-api-key');
    const expectedApiKey = Deno.env.get('APP_SERVICE_API_KEY');

    if (!expectedApiKey || apiKey !== expectedApiKey) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body?.action || 'health';

    if (action === 'health') {
      return Response.json({
        ok: true,
        service: 'appServiceAccess',
        app_id: Deno.env.get('BASE44_APP_ID') || null,
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'stats') {
      const [packages, consolidations, invoices, notifications] = await Promise.all([
        base44.asServiceRole.entities.Package.list('-created_date', 5),
        base44.asServiceRole.entities.Consolidation.list('-created_date', 5),
        base44.asServiceRole.entities.Invoice.list('-created_date', 5),
        base44.asServiceRole.entities.Notification.list('-created_date', 5),
      ]);

      return Response.json({
        ok: true,
        stats: {
          packages_recent: packages.length,
          consolidations_recent: consolidations.length,
          invoices_recent: invoices.length,
          notifications_recent: notifications.length,
        }
      });
    }

    return Response.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});