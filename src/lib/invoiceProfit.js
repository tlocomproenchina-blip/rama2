import { base44 } from '@/api/base44Client';
import { billableTotal } from '@/lib/storageLines';

// Costo real del proveedor por factura de cliente, a partir del cruce por contenedor.
// Si una factura de proveedor coincide con varias facturas de cliente, se reparte en partes iguales.
export function buildProviderCostMap(rows) {
  const map = {};
  for (const r of rows || []) {
    const list = r.client_invoices || [];
    if (!list.length) continue;
    const share = 1 / list.length;
    for (const ci of list) {
      const m = map[ci.id] || (map[ci.id] = { cost: 0, paid: 0, pending: 0 });
      m.cost += Number(r.total || 0) * share;
      m.paid += Number(r.paid || 0) * share;
      m.pending += Number(r.balance || 0) * share;
    }
  }
  return map;
}

export async function loadProviderCostMap() {
  const res = await base44.functions.invoke('providerCostCross', {});
  return buildProviderCostMap(res?.data?.rows);
}

// Ingreso de una factura pagada, costo pagado, pendiente y beneficio (ingreso − costo pagado).
export function invoiceProfit(invoice, costMap) {
  const c = costMap?.[invoice.id] || { cost: 0, paid: 0, pending: 0 };
  const revenue = invoice.status === 'pagada' ? billableTotal(invoice) : 0;
  return { revenue, costPaid: c.paid, costPending: c.pending, cost: c.cost, profit: revenue - c.paid, linked: !!costMap?.[invoice.id] };
}

export function summarizeProfit(invoices, costMap) {
  const t = { revenue: 0, costPaid: 0, costPending: 0, profit: 0, count: 0 };
  for (const inv of invoices || []) {
    if (inv.status !== 'pagada') continue;
    const p = invoiceProfit(inv, costMap);
    t.revenue += p.revenue; t.costPaid += p.costPaid; t.costPending += p.costPending; t.profit += p.profit; t.count++;
  }
  return t;
}