import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Envía un email de resumen diario (últimas 24h) a cada cliente con actividad.
// Agrupa: paquetes recibidos, en tránsito, disponibles, entregados, consolidaciones nuevas y facturas emitidas.
// Se ejecuta vía automatización scheduled (1 vez al día). Solo invocable por admin si se llama manualmente.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Si viene con usuario (invocación manual), exigir admin. Si no hay usuario (scheduled), continuar.
    let isScheduled = false;
    try {
      const user = await base44.auth.me();
      if (user && user.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    } catch {
      isScheduled = true;
    }

    const sb = base44.asServiceRole;
    const now = new Date();
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sinceIso = since.toISOString();

    // Cargar config para from_name
    let fromName = 'TLEC CARGO';
    try {
      const cfgs = await sb.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1);
      const cfg = cfgs?.[0];
      if (cfg) fromName = cfg.invoice_company_name || cfg.app_name || fromName;
    } catch {}

    // Cargar paquetes actualizados en las últimas 24h
    const recentPackages = await sb.entities.Package.filter(
      { updated_date: { $gte: sinceIso } },
      '-updated_date',
      1000
    );

    // Cargar consolidaciones creadas en las últimas 24h
    let recentConsolidations = [];
    try {
      recentConsolidations = await sb.entities.Consolidation.filter(
        { created_date: { $gte: sinceIso } },
        '-created_date',
        500
      );
    } catch {}

    // Cargar facturas creadas en las últimas 24h
    let recentInvoices = [];
    try {
      recentInvoices = await sb.entities.Invoice.filter(
        { created_date: { $gte: sinceIso } },
        '-created_date',
        500
      );
    } catch {}

    // Agrupar por client_email
    const byClient = new Map();
    const ensure = (email) => {
      if (!byClient.has(email)) {
        byClient.set(email, {
          received: [],
          in_transit: [],
          available: [],
          delivered: [],
          rejected: [],
          consolidations: [],
          invoices: []
        });
      }
      return byClient.get(email);
    };

    for (const p of recentPackages) {
      if (!p.client_email) continue;
      const bucket = ensure(p.client_email);
      switch (p.status) {
        case 'recibido': bucket.received.push(p); break;
        case 'en_transito': bucket.in_transit.push(p); break;
        case 'disponible': bucket.available.push(p); break;
        case 'entregado': bucket.delivered.push(p); break;
        case 'rechazado': bucket.rejected.push(p); break;
        default: break;
      }
    }

    for (const c of recentConsolidations) {
      if (!c.client_email) continue;
      ensure(c.client_email).consolidations.push(c);
    }

    for (const inv of recentInvoices) {
      if (!inv.client_email) continue;
      ensure(inv.client_email).invoices.push(inv);
    }

    let sent = 0;
    let skipped = 0;
    const errors = [];

    for (const [email, data] of byClient.entries()) {
      const totalActivity =
        data.received.length +
        data.in_transit.length +
        data.available.length +
        data.delivered.length +
        data.rejected.length +
        data.consolidations.length +
        data.invoices.length;

      if (totalActivity === 0) { skipped++; continue; }

      const { subject, body } = buildDigest(email, data, fromName);

      try {
        await sb.integrations.Core.SendEmail({
          to: email,
          subject,
          body,
          from_name: fromName
        });

        // Log
        try {
          await sb.entities.EmailLog.create({
            recipient_email: email,
            from_name: fromName,
            subject,
            body_preview: body.substring(0, 200),
            source: 'manual',
            status: 'sent',
            sent_date: new Date().toISOString()
          });
        } catch {}

        sent++;
      } catch (err) {
        errors.push({ email, error: err?.message || String(err) });
      }
    }

    return Response.json({
      success: true,
      scheduled: isScheduled,
      window_hours: 24,
      clients_with_activity: byClient.size,
      emails_sent: sent,
      skipped,
      errors: errors.slice(0, 10)
    });
  } catch (error) {
    console.error('sendDailyClientDigest error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function buildDigest(email, data, fromName) {
  const sectionRows = [];

  const section = (title, items, render) => {
    if (!items.length) return '';
    const list = items.map(render).join('');
    return `
      <tr><td style="padding:14px 0 6px 0;">
        <h3 style="margin:0;font-size:15px;color:#1e293b;font-weight:600;">${title} (${items.length})</h3>
      </td></tr>
      <tr><td style="padding:0 0 6px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          ${list}
        </table>
      </td></tr>
    `;
  };

  const pkgRow = (p) => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-family:monospace;font-size:13px;color:#0f172a;">${escapeHtml(p.tracking_number || '—')}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#475569;">${escapeHtml(p.description || '')}</td>
    </tr>
  `;

  const consRow = (c) => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-family:monospace;font-size:13px;color:#0f172a;">${escapeHtml(c.consolidation_tracking || c.id || '—')}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#475569;">${(c.tracking_numbers || []).length} trackings · ${escapeHtml(c.shipping_type || '')}</td>
    </tr>
  `;

  const invRow = (inv) => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-family:monospace;font-size:13px;color:#0f172a;">${escapeHtml(inv.invoice_number || inv.id || '—')}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#475569;">$${Number(inv.total || 0).toFixed(2)} · ${escapeHtml(inv.status || '')}</td>
    </tr>
  `;

  sectionRows.push(section('📥 Paquetes recibidos en almacén', data.received, pkgRow));
  sectionRows.push(section('🚚 Paquetes en tránsito', data.in_transit, pkgRow));
  sectionRows.push(section('📦 Paquetes disponibles para retiro', data.available, pkgRow));
  sectionRows.push(section('✅ Paquetes entregados', data.delivered, pkgRow));
  sectionRows.push(section('⛔ Paquetes rechazados', data.rejected, pkgRow));
  sectionRows.push(section('🧱 Nuevas consolidaciones', data.consolidations, consRow));
  sectionRows.push(section('🧾 Nuevas facturas', data.invoices, invRow));

  const totalPackages =
    data.received.length + data.in_transit.length + data.available.length + data.delivered.length + data.rejected.length;

  const subject = `📊 Resumen de actividad de tus envíos (últimas 24h)`;

  const body = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;padding:24px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
      <tr>
        <td style="padding:24px 24px 8px 24px;">
          <h2 style="margin:0;font-size:20px;color:#0f172a;">Resumen diario de tu cuenta</h2>
          <p style="margin:6px 0 0 0;font-size:13px;color:#64748b;">Actividad de las últimas 24 horas en ${escapeHtml(fromName)}.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 24px 0 24px;">
          <p style="margin:0;font-size:14px;color:#334155;">
            Hola, te dejamos el resumen de movimientos de tus envíos:
            <strong>${totalPackages}</strong> actualizaciones de paquetes,
            <strong>${data.consolidations.length}</strong> consolidaciones y
            <strong>${data.invoices.length}</strong> facturas nuevas.
          </p>
        </td>
      </tr>
      <tr><td style="padding:8px 24px 24px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          ${sectionRows.join('')}
        </table>
      </td></tr>
      <tr>
        <td style="padding:16px 24px;background:#f1f5f9;text-align:center;font-size:12px;color:#64748b;">
          Este es un resumen automático. Inicia sesión en tu cuenta para ver más detalles.
        </td>
      </tr>
    </table>
  </div>
  `;

  return { subject, body };
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}