import { connectionKeyOf, connectionLabel, listWholesalerConnections } from './wholesalerCore.ts';
import { HANDLING_FEE } from './wholesalerBilling.ts';
import { scopeFilter } from './wholesalerScope.ts';
import { num } from './paginatedFetch.ts';

const rows = (r: any) => (Array.isArray(r) ? r : r?.items || []);

export async function findConnection(base44: any, key: string) {
  const connections = await listWholesalerConnections(base44);
  return connections.find((c: any) => connectionKeyOf(c) === key) || null;
}

// Datos del portal de UN mayorista: todo filtrado por su clave.
export async function buildPortalData(base44: any, key: string) {
  const live = await findConnection(base44, key);
  if (!live) return null;
  const scope = scopeFilter(key);
  const [clients, logs, invoices] = await Promise.all([
    base44.asServiceRole.entities.WholesalerClient.filter(scope, '-created_date', 1000),
    base44.asServiceRole.entities.WholesalerLog.filter({ $and: [scope, { tracking_number: { $exists: true, $ne: '' } }] }, '-event_date', 500),
    base44.asServiceRole.entities.WholesalerInvoice.filter({ wholesaler_key: key }, '-emitted_date', 300),
  ]);
  return {
    ok: true,
    wholesaler: {
      name: connectionLabel(live),
      rate_per_cbm: num(live.rate_per_cbm),
      door_to_door_per_cbm: num(live.door_to_door_per_cbm),
      handling_fee: HANDLING_FEE,
    },
    clients: rows(clients).map((c: any) => ({
      id: c.id, full_name: c.full_name, email: c.email, cedula: c.cedula, whatsapp: c.whatsapp,
      city: c.city, state: c.state, shipping_mark: c.shipping_mark, status: c.status,
    })),
    trackings: rows(logs).map((l: any) => ({
      id: l.id, tracking_number: l.tracking_number, client_email: l.client_email,
      shipping_mark: l.shipping_mark, event_type: l.event_type, event_date: l.event_date,
    })),
    invoices: rows(invoices).map((inv: any) => ({
      id: inv.id, invoice_number: inv.invoice_number, emitted_date: inv.emitted_date,
      billing_mode: inv.billing_mode, wholesaler_name: inv.wholesaler_name, clients: inv.clients || [],
      totals: inv.totals || {}, notes: inv.notes,
    })),
  };
}