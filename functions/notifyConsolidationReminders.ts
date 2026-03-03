import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function formatDate(dateIso) {
  const d = new Date(dateIso);
  return d.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: '2-digit' });
}

function addDays(dateIso, days) {
  const d = new Date(dateIso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function ymd(dateIso) {
  const d = new Date(dateIso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${da}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Load consolidation period (default 30, else max from config)
    let periodDays = 30;
    try {
      const appCfg = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' });
      if (appCfg?.[0]?.consolidation_periods?.length) {
        periodDays = Math.max(...appCfg[0].consolidation_periods);
      }
    } catch (_e) { /* ignore */ }

    // Get all received packages (with received_date) and build earliest start per client
    const receivedPkgs = await base44.asServiceRole.entities.Package.filter({ status: 'recibido' });
    const byClient = new Map();
    for (const p of receivedPkgs || []) {
      if (!p.client_email || !p.received_date) continue;
      const key = p.client_email;
      const t = new Date(p.received_date).getTime();
      if (!byClient.has(key) || t < byClient.get(key)) {
        byClient.set(key, t);
      }
    }

    const now = Date.now();
    const results = [];

    for (const [email, startTs] of byClient.entries()) {
      // Only process clients whose consolidation period was started (we use prior start notification as marker)
      const startRef = `consolidation_start_${email}`;
      const hadStart = await base44.asServiceRole.entities.Notification.filter({ user_email: email, reference_id: startRef, type: 'system' });
      if (!hadStart || hadStart.length === 0) continue;

      const startIso = new Date(startTs).toISOString();
      const deadlineIso = addDays(startIso, periodDays);

      const daysRemaining = Math.max(0, Math.ceil((new Date(deadlineIso).getTime() - now) / (1000 * 60 * 60 * 24)));
      const daysElapsed = Math.max(0, Math.ceil((now - new Date(startIso).getTime()) / (1000 * 60 * 60 * 24)));
      const pctElapsed = periodDays > 0 ? daysElapsed / periodDays : 0;

      // Build unique refs per client+deadline to avoid duplicates across days
      const deadlineKey = ymd(deadlineIso);
      const ref70 = `consolidation_70pct_${email}_${deadlineKey}`;
      const refLast = `consolidation_lastday_${email}_${deadlineKey}`;

      // LAST-DAY REMINDER (prioridad alta): send when remaining is 1 day (or 0 if same-day execution)
      if (daysRemaining <= 1) {
        const exists = await base44.asServiceRole.entities.Notification.filter({ user_email: email, reference_id: refLast, type: 'system' });
        if (exists.length === 0) {
          const title = '📌 Último día de tu consolidación';
          const message = `Hoy es el último día de tu periodo de consolidación.\n\nFecha límite: ${formatDate(deadlineIso)}.`;

          await base44.asServiceRole.entities.Notification.create({
            user_email: email,
            title,
            message,
            type: 'system',
            priority: 'high',
            reference_id: refLast,
            icon: 'alert'
          });

          try {
            await base44.asServiceRole.integrations.Core.SendEmail({
              to: email,
              subject: 'Recordatorio: último día de tu consolidación',
              body: `Hola,\n\nHoy es el último día de tu periodo de consolidación.\nFecha límite: ${formatDate(deadlineIso)}\n\nIngresa a tu panel para finalizar tu consolidación.\n\nSaludos,\nEquipo de Soporte`
            });
          } catch (_e) {}

          results.push({ email, type: 'last_day', deadline: deadlineIso });
          continue; // if last day, skip 70% to avoid double message same day
        }
      }

      // 70% ELAPSED REMINDER (quedan ~30%)
      if (pctElapsed >= 0.7 && daysRemaining > 1) {
        const exists = await base44.asServiceRole.entities.Notification.filter({ user_email: email, reference_id: ref70, type: 'system' });
        if (exists.length === 0) {
          const title = '⏰ Te queda 30% del periodo de consolidación';
          const message = `Tu periodo de consolidación está por finalizar.\n\nDías restantes: ${daysRemaining}\nFecha límite: ${formatDate(deadlineIso)}.`;

          await base44.asServiceRole.entities.Notification.create({
            user_email: email,
            title,
            message,
            type: 'system',
            priority: 'medium',
            reference_id: ref70,
            icon: 'info'
          });

          try {
            await base44.asServiceRole.integrations.Core.SendEmail({
              to: email,
              subject: 'Recordatorio: tu consolidación entra en etapa final',
              body: `Hola,\n\nHas consumido el 70% de tu periodo de consolidación.\nDías restantes: ${daysRemaining}\nFecha límite: ${formatDate(deadlineIso)}\n\nIngresa a tu panel para revisar tus paquetes y consolidaciones.\n\nSaludos,\nEquipo de Soporte`
            });
          } catch (_e) {}

          results.push({ email, type: '70pct', deadline: deadlineIso });
        }
      }
    }

    return Response.json({ success: true, periodDays, processed: byClient.size, sent: results.length, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});