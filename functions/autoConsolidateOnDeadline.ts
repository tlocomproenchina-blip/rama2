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

    // Scheduled job – no user auth required, use service role operations safely

    // 1) Determine consolidation period (use max from config, fallback 30)
    let periodDays = 30;
    try {
      const cfg = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' });
      if (cfg?.[0]?.consolidation_periods?.length) {
        periodDays = Math.max(...cfg[0].consolidation_periods);
      }
    } catch (_e) {}

    // 2) Fetch all RECEIVED packages eligible for auto-consolidation (not already consolidated)
    const received = await base44.asServiceRole.entities.Package.filter({ status: 'recibido' });
    const eligible = (received || []).filter(p => !p.consolidation_id && p.received_date && p.client_email);

    // Group by client and shipping_type
    const byClientType = new Map(); // key: `${email}__${type}` -> array of pkgs
    for (const p of eligible) {
      const key = `${p.client_email}__${p.shipping_type}`;
      if (!byClientType.has(key)) byClientType.set(key, []);
      byClientType.get(key).push(p);
    }

    const now = Date.now();
    const results = [];

    for (const [key, pkgs] of byClientType.entries()) {
      // Find earliest received_date among this group
      const earliestTs = pkgs.reduce((min, p) => {
        const t = new Date(p.received_date).getTime();
        return Math.min(min, t);
      }, new Date(pkgs[0].received_date).getTime());

      const startIso = new Date(earliestTs).toISOString();
      const deadlineIso = addDays(startIso, periodDays);

      if (now < new Date(deadlineIso).getTime()) continue; // Not yet at deadline

      const [email, shippingType] = key.split('__');

      // Build consolidation payload
      const consolidationTracking = `CONS-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const packageIds = pkgs.map(p => p.id);
      const trackingNumbers = pkgs.map(p => p.tracking_number).filter(Boolean);
      const shippingMark = pkgs.find(p => p.shipping_mark)?.shipping_mark || '';

      const consolidation = await base44.asServiceRole.entities.Consolidation.create({
        consolidation_tracking: consolidationTracking,
        client_email: email,
        shipping_mark: shippingMark,
        package_ids: packageIds,
        tracking_numbers: trackingNumbers,
        shipping_type: shippingType,
        status: 'en_transito', // pipeline actual: consolidada (creada) → se embarca → en_transito
        consolidation_period_days: periodDays,
        consolidation_request_id: null
      });

      // Update package records
      for (const pkg of pkgs) {
        await base44.asServiceRole.entities.Package.update(pkg.id, {
          status: 'consolidado',
          consolidation_id: consolidation.id
        });
      }

      // Notify client (in‑app + email)
      const listStr = pkgs.map(p => `• ${p.tracking_number}`).join('\n');
      const title = '📦 Consolidación automática creada';
      const message = `Tu periodo de consolidación finalizó y hemos consolidado automáticamente tus paquetes.\n\nPaquetes (${pkgs.length}):\n${listStr}\n\nTracking de consolidación: ${consolidationTracking}\nLímite: ${formatDate(deadlineIso)}`;

      await base44.asServiceRole.entities.Notification.create({
        user_email: email,
        title,
        message,
        type: 'consolidation',
        priority: 'high',
        reference_id: consolidation.id,
        entity_type: 'Consolidation',
        icon: 'truck'
      });

      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: email,
          subject: `Consolidación automática lista - ${consolidationTracking}`,
          body: `Hola,\n\nTu periodo de consolidación ha finalizado y consolidamos automáticamente tus paquetes.\n\nPaquetes (${pkgs.length}):\n${pkgs.map(p => `- ${p.tracking_number} (${p.description || ''})`).join('\n')}\n\nTracking consolidado: ${consolidationTracking}\nFecha límite: ${formatDate(deadlineIso)}\n\nPuedes ver los detalles en tu panel.\n\nGracias.`
        });
      } catch (_e) {}

      // Notify admins
      try {
        const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
        for (const a of admins || []) {
          await base44.asServiceRole.entities.Notification.create({
            user_email: a.email,
            title: '📦 Consolidación automática creada',
            message: `${pkgs.length} paquete(s) de ${email} consolidados automáticamente: ${consolidationTracking}`,
            type: 'consolidation',
            priority: 'medium',
            reference_id: consolidation.id,
            entity_type: 'Consolidation',
            icon: 'truck'
          });
        }
      } catch (_e) {}

      results.push({ email, shippingType, packages: pkgs.length, consolidationId: consolidation.id });
    }

    return Response.json({ success: true, periodDays, created: results.length, details: results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});