// Resumen diario para administradores (1 email por admin, 1 vez al día).
// Se ejecuta vía automatización programada a las 8am hora Venezuela (12:00 UTC).
// Resume: paquetes registrados, nuevos clientes, pagos aprobados, tickets de soporte,
// paquetes asegurados + monto, facturas emitidas + monto, y métricas pendientes clave.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.42';
import { sendBrevoEmail } from '../../shared/brevoEmail.ts';

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
    const since = new Date(now.getTime() - DAY_MS).toISOString();
    const appName = cfg.app_name || 'TLEC CARGO';

    // === Consultas en paralelo ===
    const [
      recentPackages,
      recentUsers,
      recentPayments,
      recentTickets,
      recentInvoices,
      pendingPayments,
      pendingAssisted,
      openTickets,
      admins
    ] = await Promise.all([
      base44.asServiceRole.entities.Package.list('-created_date', 500),
      base44.asServiceRole.entities.User.list('-created_date', 500),
      base44.asServiceRole.entities.InvoicePayment.list('-approved_date', 500),
      base44.asServiceRole.entities.SupportTicket.list('-created_date', 500),
      base44.asServiceRole.entities.Invoice.list('-created_date', 500),
      base44.asServiceRole.entities.InvoicePayment.filter({ status: 'pendiente' }, '-created_date', 500),
      base44.asServiceRole.entities.AssistedPaymentRequest.filter({ status: 'pendiente' }, '-created_date', 500),
      base44.asServiceRole.entities.SupportTicket.filter({ status: 'abierto' }, '-created_date', 500),
      base44.asServiceRole.entities.User.list('-created_date', 500),
    ]);

    // === Filtrar por últimas 24h ===
    const newPackages = (recentPackages || []).filter(p => p.created_date && p.created_date >= since);
    const newClients = (recentUsers || []).filter(u => u.role === 'user' && u.created_date && u.created_date >= since);
    const newPayments = (recentPayments || []).filter(p => p.status === 'aprobado' && p.approved_date && p.approved_date >= since);
    const newTickets = (recentTickets || []).filter(t => t.created_date && t.created_date >= since);
    const newInvoices = (recentInvoices || []).filter(i => i.created_date && i.created_date >= since);

    // Paquetes asegurados (recientes)
    const insuredRecent = newPackages.filter(p => p.has_insurance);
    const insuredCount = insuredRecent.length;
    const insuredTotalFob = insuredRecent.reduce((s, p) => s + Number(p.fob_value || 0), 0);

    // Totales
    const paymentsTotal = newPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const invoicesTotal = newInvoices.reduce((s, i) => s + Number(i.total || 0), 0);
    const invoicesPaidTotal = newInvoices.filter(i => i.status === 'pagada').reduce((s, i) => s + Number(i.total || 0), 0);

    // Métricas pendientes (estado actual, no solo 24h)
    const pendingPaymentsCount = (pendingPayments || []).length;
    const pendingAssistedCount = (pendingAssisted || []).length;
    const openTicketsCount = (openTickets || []).length;

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