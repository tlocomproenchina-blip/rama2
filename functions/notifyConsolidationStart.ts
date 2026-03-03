import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function addDays(dateIso, days) {
  const d = new Date(dateIso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function formatDate(dateIso) {
  const d = new Date(dateIso);
  return d.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: '2-digit' });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const payload = await req.json();
    const event = payload?.event;
    const data = payload?.data;
    const oldData = payload?.old_data;

    if (!event || event.entity_name !== 'Package' || event.type !== 'update') {
      return Response.json({ skipped: true, reason: 'Not a Package update event' });
    }

    // Ensure we have latest package data
    let pkg = data;
    if (payload?.payload_too_large || !pkg) {
      pkg = await base44.asServiceRole.entities.Package.get(event.entity_id);
    }

    // Trigger only when status changes to 'recibido'
    if ((oldData?.status === 'recibido') || pkg.status !== 'recibido') {
      return Response.json({ skipped: true, reason: 'Status not transitioned to recibido' });
    }

    const clientEmail = pkg.client_email;
    if (!clientEmail) {
      return Response.json({ skipped: true, reason: 'Missing client_email' });
    }

    // Fetch client's packages to evaluate condition
    const allClientPkgs = await base44.asServiceRole.entities.Package.filter({ client_email: clientEmail });

    const receivedPkgs = allClientPkgs.filter(p => p.status === 'recibido' && p.received_date);
    const pendingToReceive = allClientPkgs.filter(p => p.status === 'pre_alerta');

    // Only notify when at least one received (this one) and there are others pending to receive
    if (receivedPkgs.length < 1 || pendingToReceive.length < 1) {
      return Response.json({ skipped: true, reason: 'Condition not met (no pending or no received)' });
    }

    // Use earliest received_date as start date
    const earliestReceived = receivedPkgs.reduce((min, p) => {
      const t = new Date(p.received_date).getTime();
      return t < min ? t : min;
    }, new Date(receivedPkgs[0].received_date).getTime());
    const startDateIso = new Date(earliestReceived).toISOString();

    // Determine consolidation period days (default 30)
    let periodDays = 30;
    try {
      const appCfg = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' });
      if (appCfg?.[0]?.consolidation_periods?.length) {
        // Pick the max as default period if available (common practice)
        periodDays = Math.max(...appCfg[0].consolidation_periods);
      }
    } catch (_e) { /* optional */ }

    const deadlineIso = addDays(startDateIso, periodDays);
    const now = Date.now();
    const daysRemaining = Math.max(0, Math.ceil((new Date(deadlineIso).getTime() - now) / (1000 * 60 * 60 * 24)));

    // Avoid duplicate notifications: check by reference_id
    const refId = `consolidation_start_${clientEmail}`;
    const existing = await base44.asServiceRole.entities.Notification.filter({ user_email: clientEmail, reference_id: refId, type: 'system' });
    if (existing.length > 0) {
      return Response.json({ skipped: true, reason: 'Already notified' });
    }

    const title = '⏳ Inició tu periodo de consolidación';
    const message = `Tu periodo de consolidación ha iniciado desde el ${formatDate(startDateIso)}.\n\nDías restantes: ${daysRemaining}\nFecha límite: ${formatDate(deadlineIso)}.`;

    // In-app notification
    await base44.asServiceRole.entities.Notification.create({
      user_email: clientEmail,
      title,
      message,
      type: 'system',
      priority: 'medium',
      reference_id: refId,
      icon: 'info'
    });

    // Email notification
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: clientEmail,
        subject: 'Inició tu periodo de consolidación',
        body: `Hola,\n\nTu periodo de consolidación ha iniciado.\n\nInicio: ${formatDate(startDateIso)}\nDías restantes: ${daysRemaining}\nFecha límite: ${formatDate(deadlineIso)}\n\nIngresa a tu panel para revisar tus paquetes y consolidaciones.\n\nSaludos,\nEquipo de Soporte`
      });
    } catch (_e) { /* If email fails, still return success for in-app */ }

    return Response.json({ success: true, notified: true, client_email: clientEmail, daysRemaining, deadline: deadlineIso });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});