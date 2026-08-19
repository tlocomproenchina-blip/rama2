// Resumen diario para administradores (1 email por admin, 1 vez al día).
// Se ejecuta vía automatización programada a las 8am hora Venezuela (12:00 UTC).
// Resume: paquetes registrados, nuevos clientes, pagos aprobados, tickets de soporte,
// paquetes asegurados + monto, facturas emitidas + monto, y métricas pendientes clave.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.42';
import { sendBrevoEmail } from '../../shared/brevoEmail.ts';
import { fetchDailySummaryMetrics } from '../../shared/dailySummary.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

function fmt(n: number | undefined | null): string {
  const v = Number(n || 0);
  return v.toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtUsd(n: number | undefined | null): string {
  const v = Number(n || 0);
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: Date): string {
  return d.toLocaleString('es-VE', { timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    // Permitir automatizaciones programadas (header x-base44-automation) o admin manual
    const isAutomation = req.headers.get('x-base44-automation') === 'true';
    if (!isAutomation && (!user || user.role !== 'admin')) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Kill switch global de emails
    const cfgs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' });
    const cfg = cfgs?.[0] || {};
    if (cfg.emails_enabled === false) {
      return Response.json({ skipped: true, reason: 'emails_enabled is off' });
    }

    const now = new Date();
    const appName = cfg.app_name || 'TLEC CARGO';

    // === Métricas agregadas (lógica compartida con getDailySummary) ===
    const metrics = await fetchDailySummaryMetrics(base44);
    const admins = await base44.asServiceRole.entities.User.list('-created_date', 500);

    const newPackages = { length: metrics.activity.new_packages };
    const newClients = { length: metrics.activity.new_clients };
    const newPayments = { length: metrics.activity.new_payments_count };
    const newTickets = { length: metrics.activity.new_tickets };
    const newInvoices = { length: metrics.activity.new_invoices_count };
    const paymentsTotal = metrics.activity.new_payments_total;
    const invoicesTotal = metrics.activity.new_invoices_total;
    const insuredCount = metrics.activity.insured_count;
    const insuredTotalFob = metrics.activity.insured_total_fob;
    const pendingPaymentsCount = metrics.pending.pending_payments;
    const pendingAssistedCount = metrics.pending.pending_assisted;
    const openTicketsCount = metrics.pending.open_tickets;

    // === Construir email HTML ===
    const periodStart = fmtDate(new Date(now.getTime() - DAY_MS));
    const periodEnd = fmtDate(now);

    const rows = [
      { label: '📦 Paquetes registrados', value: fmt(newPackages.length), highlight: newPackages.length > 0 },
      { label: '👥 Nuevos clientes', value: fmt(newClients.length), highlight: newClients.length > 0 },
      { label: '💳 Pagos aprobados', value: `${fmt(newPayments.length)} (${fmtUsd(paymentsTotal)})`, highlight: newPayments.length > 0 },
      { label: '🧾 Facturas emitidas', value: `${fmt(newInvoices.length)} (${fmtUsd(invoicesTotal)})`, highlight: newInvoices.length > 0 },
      { label: '🛡️ Paquetes asegurados', value: `${fmt(insuredCount)} (${fmtUsd(insuredTotalFob)} FOB)`, highlight: insuredCount > 0 },
      { label: '🎫 Tickets de soporte nuevos', value: fmt(newTickets.length), highlight: newTickets.length > 0 },
    ];

    const pendingRows = [
      { label: '⏳ Pagos por validar', value: fmt(pendingPaymentsCount), alert: pendingPaymentsCount > 0 },
      { label: '🛒 Pagos asistidos pendientes', value: fmt(pendingAssistedCount), alert: pendingAssistedCount > 0 },
      { label: '🎫 Tickets abiertos', value: fmt(openTicketsCount), alert: openTicketsCount > 0 },
    ];

    const buildTable = (items, title) => `
      <tr><td colspan="2" style="padding:14px 20px 6px;background:#f1f5f9;font-size:13px;font-weight:700;color:#0f172a;letter-spacing:.03em;text-transform:uppercase;">${title}</td></tr>
      ${items.map(r => `
        <tr>
          <td style="padding:10px 20px;font-size:14px;color:#334155;border-bottom:1px solid #e2e8f0;">${r.label}</td>
          <td style="padding:10px 20px;font-size:15px;font-weight:700;text-align:right;color:${r.highlight ? '#16a34a' : r.alert ? '#dc2626' : '#0f172a'};border-bottom:1px solid #e2e8f0;white-space:nowrap;">${r.value}</td>
        </tr>
      `).join('')}
    `;

    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;">
    <div style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px -8px rgba(15,23,42,.12);">
      <div style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:28px 24px;text-align:center;">
        <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;letter-spacing:-.02em;">📊 Resumen Diario</h1>
        <p style="margin:6px 0 0;color:#bfdbfe;font-size:13px;">${appName} · ${periodStart} → ${periodEnd}</p>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        ${buildTable(rows, 'Actividad de las últimas 24 horas')}
        ${buildTable(pendingRows, 'Pendientes actuales')}
      </table>
      <div style="padding:20px;text-align:center;">
        <a href="https://app.base44.com" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:10px;">Ir al panel de administración</a>
      </div>
    </div>
    <p style="margin:16px 0 0;text-align:center;font-size:11px;color:#94a3b8;">Este es un resumen automático diario. Si no quieres recibirlo, contacta al equipo de soporte.</p>
  </div>
</body></html>`;

    const subject = `📊 Resumen diario ${appName} — ${newPackages.length} paquetes, ${newInvoices.length} facturas, ${newPayments.length} pagos`;

    // === Enviar a cada administrador ===
    const adminEmails = (admins || []).filter(u => u.role === 'admin' && u.email).map(u => u.email);
    const uniqueAdmins = [...new Set(adminEmails)];

    if (uniqueAdmins.length === 0) {
      return Response.json({ skipped: true, reason: 'No admin users found' });
    }

    let sent = 0;
    const errors = [];
    for (const email of uniqueAdmins) {
      const res = await sendBrevoEmail(base44, {
        to: email,
        subject,
        body: html,
        from_name: appName,
        source: 'daily_admin_digest',
        campaign_name: 'Resumen Diario Admin',
      });
      if (res.sent) sent++;
      else errors.push({ email, error: res.error });
    }

    return Response.json({
      sent,
      total_admins: uniqueAdmins.length,
      period: { start: periodStart, end: periodEnd },
      metrics: {
        newPackages: newPackages.length,
        newClients: newClients.length,
        newPayments: newPayments.length,
        paymentsTotal,
        newInvoices: newInvoices.length,
        invoicesTotal,
        insuredCount,
        insuredTotalFob,
        newTickets: newTickets.length,
        pendingPaymentsCount,
        pendingAssistedCount,
        openTicketsCount,
      },
      errors: errors.length ? errors : undefined,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});