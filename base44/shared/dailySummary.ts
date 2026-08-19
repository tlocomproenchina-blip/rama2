// Lógica compartida de agregación del Resumen Diario.
// Usada por getDailySummary (API del panel admin) y sendDailyAdminDigest (email diario).
// Evita duplicar las consultas y el filtrado de las últimas 24h + conteos de pendientes.

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Obtiene todas las métricas del Resumen Diario en una sola pasada.
 * @param base44 - cliente con asServiceRole ya configurado
 * @returns objeto plano con activity + pending + period (sin arrays de registros)
 */
export async function fetchDailySummaryMetrics(base44) {
  const now = new Date();
  const since = new Date(now.getTime() - DAY_MS).toISOString();

  const [
    recentPackages,
    recentUsers,
    recentPayments,
    recentTickets,
    recentInvoices,
    pendingPayments,
    pendingAssisted,
    openTickets,
    pendingQuotes,
    reviewInvoices,
    pendingConsolidations,
  ] = await Promise.all([
    base44.asServiceRole.entities.Package.list('-created_date', 500),
    base44.asServiceRole.entities.User.list('-created_date', 500),
    base44.asServiceRole.entities.InvoicePayment.list('-approved_date', 500),
    base44.asServiceRole.entities.SupportTicket.list('-created_date', 500),
    base44.asServiceRole.entities.Invoice.list('-created_date', 500),
    base44.asServiceRole.entities.InvoicePayment.filter({ status: 'pendiente' }, '-created_date', 1000),
    base44.asServiceRole.entities.AssistedPaymentRequest.filter({ status: 'pendiente' }, '-created_date', 1000),
    base44.asServiceRole.entities.SupportTicket.filter({ status: 'abierto' }, '-created_date', 1000),
    base44.asServiceRole.entities.Quote.filter({ status: 'cliente_completo' }, '-updated_date', 1000),
    base44.asServiceRole.entities.Invoice.filter({ status: 'revision' }, '-invoice_date', 1000),
    base44.asServiceRole.entities.Consolidation.filter({ status: 'pago_pendiente_validacion' }, '-created_date', 1000),
  ]);

  // === Filtrado por las últimas 24h (server-side, no viaja al cliente) ===
  const newPackages = (recentPackages || []).filter((p) => p.created_date && p.created_date >= since);
  const newClients = (recentUsers || []).filter((u) => u.role === 'user' && u.created_date && u.created_date >= since);
  const clientsWithoutMark = newClients.filter((u) => !u.shipping_mark);
  const newPayments = (recentPayments || []).filter((p) => p.status === 'aprobado' && p.approved_date && p.approved_date >= since);
  const newTickets = (recentTickets || []).filter((t) => t.created_date && t.created_date >= since);
  const newInvoices = (recentInvoices || []).filter((i) => i.created_date && i.created_date >= since);

  const insuredRecent = newPackages.filter((p) => p.has_insurance);
  const paymentsTotal = newPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const invoicesTotal = newInvoices.reduce((s, i) => s + Number(i.total || 0), 0);
  const insuredTotalFob = insuredRecent.reduce((s, p) => s + Number(p.fob_value || 0), 0);

  const pendingPaymentsCount = (pendingPayments || []).length + (reviewInvoices || []).length + (pendingConsolidations || []).length;
  const pendingAssistedCount = (pendingAssisted || []).length;
  const openTicketsCount = (openTickets || []).length;
  const pendingQuotesCount = (pendingQuotes || []).length;

  return {
    period_start: new Date(now.getTime() - DAY_MS).toISOString(),
    period_end: now.toISOString(),
    activity: {
      new_packages: newPackages.length,
      new_clients: newClients.length,
      clients_without_mark: clientsWithoutMark.length,
      new_payments_count: newPayments.length,
      new_payments_total: paymentsTotal,
      new_invoices_count: newInvoices.length,
      new_invoices_total: invoicesTotal,
      insured_count: insuredRecent.length,
      insured_total_fob: insuredTotalFob,
      new_tickets: newTickets.length,
    },
    pending: {
      pending_payments: pendingPaymentsCount,
      pending_assisted: pendingAssistedCount,
      pending_quotes: pendingQuotesCount,
      open_tickets: openTicketsCount,
    },
  };
}