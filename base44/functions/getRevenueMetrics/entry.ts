import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

async function fetchAll(entity, sortBy = '-created_date', batchSize = 200) {
  let all = [];
  let skip = 0;
  for (let i = 0; i < 50; i++) {
    const batch = await entity.list(sortBy, batchSize, skip);
    if (!batch || batch.length === 0) break;
    all = all.concat(batch);
    if (batch.length < batchSize) break;
    skip += batchSize;
  }
  return all;
}

function getMonthKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const payload = await req.json().catch(() => ({}));
    const { startMonth, endMonth } = payload; // format: "YYYY-MM"

    // Fetch all data in parallel
    const [cbmRecords, invoices, users] = await Promise.all([
      fetchAll(base44.asServiceRole.entities.CbmIngreso),
      fetchAll(base44.asServiceRole.entities.Invoice),
      fetchAll(base44.asServiceRole.entities.User),
    ]);

    // Build user name map
    const userNameMap = {};
    users.forEach(u => {
      userNameMap[u.email] = u.full_name || u.first_name || u.email;
    });

    // Filter by date range if provided
    const inRange = (monthKey) => {
      if (!monthKey) return false;
      if (startMonth && monthKey < startMonth) return false;
      if (endMonth && monthKey > endMonth) return false;
      return true;
    };

    // --- CBM aggregation ---
    const cbmByMonth = {};
    const cbmByClient = {};
    let totalCbm = 0;

    cbmRecords.forEach(r => {
      const month = r.mes || getMonthKey(r.fecha);
      if (!inRange(month)) return;

      const cbm = Number(r.cbm) || 0;
      totalCbm += cbm;

      // By month
      if (!cbmByMonth[month]) cbmByMonth[month] = 0;
      cbmByMonth[month] += cbm;

      // By client
      const email = r.client_email || 'sin_cliente';
      if (!cbmByClient[email]) cbmByClient[email] = { email, name: r.client_name || userNameMap[email] || email, cbm: 0 };
      cbmByClient[email].cbm += cbm;
    });

    // --- Invoice aggregation ---
    const revenueByMonth = {};
    const pendingByMonth = {};
    const profitByMonth = {};
    const revenueByClient = {};
    let totalRevenue = 0;
    let totalPending = 0;
    let totalProfit = 0;
    let totalProviderCost = 0;

    invoices.forEach(inv => {
      const month = getMonthKey(inv.invoice_date);
      if (!inRange(month)) return;

      const total = Number(inv.total) || 0;
      const providerCost = Number(inv.provider_cost_total) || 0;
      // Ganancia real por factura: profit_amount si existe, si no total - costo proveedor
      const profit = (inv.profit_amount !== undefined && inv.profit_amount !== null)
        ? Number(inv.profit_amount) || 0
        : total - providerCost;
      const email = inv.client_email || 'sin_cliente';
      const name = userNameMap[email] || email;

      if (!revenueByClient[email]) {
        revenueByClient[email] = { email, name, paid: 0, pending: 0, total: 0, profit: 0, invoiceCount: 0 };
      }
      revenueByClient[email].invoiceCount++;
      revenueByClient[email].total += total;

      if (inv.status === 'pagada') {
        totalRevenue += total;
        totalProfit += profit;
        totalProviderCost += providerCost;
        if (!revenueByMonth[month]) revenueByMonth[month] = 0;
        revenueByMonth[month] += total;
        if (!profitByMonth[month]) profitByMonth[month] = 0;
        profitByMonth[month] += profit;
        revenueByClient[email].paid += total;
        revenueByClient[email].profit += profit;
      } else if (inv.status === 'pendiente' || inv.status === 'vencida' || inv.status === 'revision') {
        totalPending += total;
        if (!pendingByMonth[month]) pendingByMonth[month] = 0;
        pendingByMonth[month] += total;
        revenueByClient[email].pending += total;
      }
    });

    // --- Build monthly chart data ---
    const allMonths = new Set([
      ...Object.keys(cbmByMonth),
      ...Object.keys(revenueByMonth),
      ...Object.keys(pendingByMonth),
    ]);
    const monthlyData = Array.from(allMonths).sort().map(month => ({
      month,
      cbm: Math.round((cbmByMonth[month] || 0) * 100) / 100,
      revenue: Math.round((revenueByMonth[month] || 0) * 100) / 100,
      pending: Math.round((pendingByMonth[month] || 0) * 100) / 100,
      profit: Math.round((profitByMonth[month] || 0) * 100) / 100,
    }));

    // --- Build client table data ---
    const clientEmails = new Set([
      ...Object.keys(cbmByClient),
      ...Object.keys(revenueByClient),
    ]);
    const clientData = Array.from(clientEmails).map(email => {
      const cbmInfo = cbmByClient[email] || { cbm: 0 };
      const revInfo = revenueByClient[email] || { paid: 0, pending: 0, total: 0, profit: 0, invoiceCount: 0 };
      return {
        email,
        name: revInfo.name || cbmInfo.name || userNameMap[email] || email,
        cbm: Math.round((cbmInfo.cbm || 0) * 100) / 100,
        paid: Math.round(revInfo.paid * 100) / 100,
        pending: Math.round(revInfo.pending * 100) / 100,
        profit: Math.round((revInfo.profit || 0) * 100) / 100,
        totalInvoiced: Math.round(revInfo.total * 100) / 100,
        invoiceCount: revInfo.invoiceCount,
      };
    }).sort((a, b) => b.totalInvoiced - a.totalInvoiced);

    // --- Invoice status breakdown ---
    const statusMap = {};
    invoices.forEach(inv => {
      const month = getMonthKey(inv.invoice_date);
      if (!inRange(month)) return;
      const st = inv.status || 'pendiente';
      if (!statusMap[st]) statusMap[st] = { status: st, count: 0, amount: 0 };
      statusMap[st].count++;
      statusMap[st].amount += Number(inv.total) || 0;
    });
    const invoiceStatusData = Object.values(statusMap)
      .map(s => ({ ...s, amount: Math.round(s.amount * 100) / 100 }))
      .sort((a, b) => b.count - a.count);

    return Response.json({
      summary: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalProfit: Math.round(totalProfit * 100) / 100,
        totalProviderCost: Math.round(totalProviderCost * 100) / 100,
        totalPending: Math.round(totalPending * 100) / 100,
        totalCbm: Math.round(totalCbm * 100) / 100,
        totalInvoices: invoices.filter(inv => { const m = getMonthKey(inv.invoice_date); return inRange(m); }).length,
        totalClients: clientData.length,
      },
      monthlyData,
      clientData,
      invoiceStatusData,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});