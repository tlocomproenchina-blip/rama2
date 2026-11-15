import { base44 } from '@/api/base44Client';

// Marca/desmarca "pagado al proveedor" en las facturas de cliente según si
// todas las facturas de proveedor de sus contenedores están pagadas.
// Devuelve un mapa { invoiceId: boolean } con los cambios aplicados.
export async function syncProviderPaid(invoices) {
  const res = await base44.functions.invoke('providerCostCross', {});
  const rows = res?.data?.rows || [];
  const state = {};
  for (const r of rows) {
    const paid = r.status === 'pagada' || Number(r.balance) <= 0;
    for (const ci of r.client_invoices || []) {
      state[ci.id] = (state[ci.id] ?? true) && paid;
    }
  }
  const changes = {};
  const now = new Date().toISOString();
  await Promise.all(invoices
    .filter((inv) => inv.id in state && !!inv.provider_paid !== state[inv.id])
    .map((inv) => {
      changes[inv.id] = state[inv.id];
      return base44.entities.Invoice.update(inv.id, {
        provider_paid: state[inv.id],
        provider_paid_date: state[inv.id] ? now : null,
      });
    }));
  return changes;
}