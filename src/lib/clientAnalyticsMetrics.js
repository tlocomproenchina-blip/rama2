import { billableTotal } from '@/lib/storageLines';

import { num } from '@/lib/numbers';

function getLastMonths(count) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: date.toLocaleDateString('es-VE', { month: 'short', year: '2-digit' })
    };
  });
}

// Métricas de la ficha calculadas con los datos que el cliente realmente tiene:
// facturas, abonos, recibos CBM y paquetes.
export function computeClientMetrics({ invoices, payments, cbmIngresos, packages }) {
  const months = getLastMonths(6);
  const monthMap = new Map(months.map((m) => [m.key, { ...m, amount: 0 }]));
  const active = invoices.filter((inv) => inv.status !== 'cancelada');

  active.forEach((inv) => {
    const date = new Date(inv.invoice_date || inv.created_date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (monthMap.has(key)) monthMap.get(key).amount += billableTotal(inv);
  });
  const monthlySpend = Array.from(monthMap.values());

  const approvedByInvoice = new Map();
  payments.filter((p) => p.status === 'aprobado' && p.invoice_id).forEach((p) => {
    approvedByInvoice.set(p.invoice_id, (approvedByInvoice.get(p.invoice_id) || 0) + num(p.amount));
  });
  // Igual que en Facturas y abonos: una factura "pagada" cuenta como saldada.
  const balance = active.reduce((sum, inv) => {
    const billed = billableTotal(inv);
    const paid = inv.status === 'pagada' ? billed : (approvedByInvoice.get(inv.id) || 0);
    return sum + Math.max(billed - paid, 0);
  }, 0);

  return {
    monthlySpend,
    totalSpend: active.reduce((sum, inv) => sum + billableTotal(inv), 0),
    monthlyAverage: monthlySpend.reduce((sum, m) => sum + m.amount, 0) / months.length,
    balance,
    totalCbm: cbmIngresos.reduce((sum, r) => sum + num(r.cbm), 0),
    receiptCount: cbmIngresos.length,
    packageCount: packages.length
  };
}