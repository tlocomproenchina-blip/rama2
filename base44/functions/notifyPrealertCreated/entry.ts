import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Auth may not exist for automations; don't block execution
    try { await base44.auth.me(); } catch (_) {}

    const payload = await req.json().catch(() => ({}));

    // Expected automation payload shape
    const event = payload?.event || {};
    const entityName = event.entity_name || payload?.entity_name;
    const entityId = event.entity_id || payload?.entity_id;

    if (entityName && entityName !== 'Package') {
      return Response.json({ skipped: true, reason: 'not a Package event' });
    }

    // Prefer included data, fallback to fetch
    let data = payload?.data;
    if (!data && entityId) {
      const pkgs = await base44.asServiceRole.entities.Package.filter({ id: entityId });
      data = pkgs?.[0] || null;
    }

    if (!data) {
      return Response.json({ skipped: true, reason: 'no package data' });
    }

    // Pre-alert email alerts disabled
    return Response.json({ skipped: true, reason: 'pre-alert email notifications disabled' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});