import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Envía 1 email diario a cada cliente que recibió paquetes en las últimas 24 horas,
// con el resumen de lo recibido. Nada más.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Kill switch global de emails
    const cfgs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' });
    const cfg = cfgs?.[0] || {};
    if (cfg.emails_enabled === false) {
      return Response.json({ skipped: true, reason: 'emails_enabled is off' });
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Paquetes recibidos en las últimas 24h
    const recent = await base44.asServiceRole.entities.Package.list('-received_date', 500);
    const received = (recent || []).filter(p => p.received_date && p.received_date >= since && p.client_email);

    if (received.length === 0) {
      return Response.json({ sent: 0, message: 'No hay paquetes recibidos en las últimas 24h' });
    }

    // Agrupar por cliente
    const byClient = new Map();
    for (const p of received) {
      const list = byClient.get(p.client_email) || [];
      list.push(p);
      byClient.set(p.client_email, list);
    }

    const appName = cfg.app_name || 'TLEC CARGO';
    let sent = 0;
    const errors = [];

    for (const [email, pkgs] of byClient) {
      const lines = pkgs.map(p => {
        const parts = [`• ${p.tracking_number} — ${p.description || 'Sin descripción'}`];
        if (p.actual_weight_kg) parts.push(`  Peso: ${p.actual_weight_kg} kg`);
        if (p.actual_cbm) parts.push(`  CBM: ${p.actual_cbm}`);
        return parts.join('\n');
      }).join('\n\n');

      const body = `Hola,\n\nHoy recibimos en nuestro almacén ${pkgs.length} paquete(s) tuyo(s):\n\n${lines}\n\nPuedes ver los detalles en tu portal de cliente.\n\nSaludos,\nEquipo ${appName}`;

      const subject = `📦 Resumen diario: ${pkgs.length} paquete(s) recibido(s) - ${appName}`;
      let emailSent = false;
      let errMsg = null;
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: email,
          subject,
          body,
          from_name: appName
        });
        emailSent = true;
        sent++;
      } catch (e) {
        errMsg = e.message;
        errors.push({ email, error: e.message });
      }

      // Registrar en EmailLog para auditoría (con el cuerpo completo)
      try {
        await base44.asServiceRole.entities.EmailLog.create({
          recipient_email: email,
          from_name: appName,
          subject,
          body_preview: body,
          source: 'campaign',
          campaign_name: 'Resumen diario de recepción',
          status: emailSent ? 'sent' : 'failed',
          bounce_reason: emailSent ? null : errMsg,
          sent_date: new Date().toISOString()
        });
      } catch (_) {}
    }

    return Response.json({ sent, clients: byClient.size, packages: received.length, errors });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});