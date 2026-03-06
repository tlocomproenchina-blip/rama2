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

    // Only notify on creation of prealerta
    // If the automation is on create, just confirm status is pre_alerta (or empty defaults to pre_alerta)
    const status = data.status || 'pre_alerta';
    if (status !== 'pre_alerta') {
      return Response.json({ skipped: true, reason: 'status is not pre_alerta' });
    }

    // Load branding/app name
    let appName = 'TLEC CARGO';
    try {
      const cfg = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' });
      if (cfg?.length) appName = cfg[0].app_name || appName;
    } catch (_) {}

    // Find recipients: users with custom_role = 'gerente_operaciones'
    const recipients = await base44.asServiceRole.entities.User.filter({ custom_role: 'gerente_operaciones' });
    const emails = (recipients || []).map(u => u.email).filter(Boolean);

    if (emails.length === 0) {
      return Response.json({ skipped: true, reason: 'no recipients with custom_role=gerente_operaciones' });
    }

    const subject = `Nueva prealerta registrada`;
    const lines = [
      `Se ha registrado una nueva prealerta en el sistema.`,
      '',
      `Cliente: ${data.client_email || 'N/D'}`,
      `Tracking: ${data.tracking_number || 'N/D'}`,
      `Tipo de envío: ${data.shipping_type || 'N/D'}`,
      `Descripción: ${data.description || 'N/D'}`,
      '',
      `Este es un aviso automático de ${appName}.`
    ];
    const body = lines.join('\n');

    // Send individually to each recipient + crear notificación en app
    const results = [];
    for (const to of emails) {
      const res = await base44.integrations.Core.SendEmail({
        from_name: appName,
        to,
        subject,
        body,
      });
      try {
        await base44.asServiceRole.entities.AppNotification.create({
          user_email: to,
          title: '📦 Nueva prealerta registrada',
          message: `${data?.client_email || 'Cliente'} • ${data?.tracking_number || 'Sin tracking'}`,
          type: 'package',
          category: 'OPERATIONAL',
          priority: 'HIGH',
          reference_id: data?.id || data?.tracking_number || undefined,
          resource_type: 'Package',
          icon: 'package'
        });
      } catch (_) {}
      results.push({ to, status: 'sent', res });
    }

    return Response.json({ success: true, recipients: emails, count: emails.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});