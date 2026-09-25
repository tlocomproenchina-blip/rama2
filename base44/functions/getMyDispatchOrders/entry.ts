import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Devuelve las órdenes de despacho del cliente autenticado (excluyendo canceladas).
// DispatchOrder tiene RLS de solo lectura para admins, por eso usamos asServiceRole
// y devolvemos solo los campos mínimos del cliente (sin client_snapshot ni datos sensibles).
// Enriquece cada item con cbm_order_number: el invoice_number de CbmIngreso cuyo
// tracking_numbers contiene el tracking_number del item.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!user.email) return Response.json({ error: 'Sin email' }, { status: 400 });

    const orders = await base44.asServiceRole.entities.DispatchOrder.filter(
      { client_email: user.email, status: { $ne: 'cancelada' } },
      '-created_date',
      200
    );

    // Recolectar todos los trackings de los items para hacer lookup en CbmIngreso
    const allTrackings = new Set<string>();
    for (const o of orders || []) {
      for (const it of o.items || []) {
        if (it.tracking_number) allTrackings.add(it.tracking_number);
      }
    }

    // Buscar CbmIngreso del cliente y mapear tracking → invoice_number
    const trackingToOrder = new Map<string, string>();
    if (allTrackings.size > 0) {
      try {
        const cbms = await base44.asServiceRole.entities.CbmIngreso.filter(
          { client_email: user.email }, '-fecha', 200
        );
        for (const c of cbms || []) {
          const tn = Array.isArray(c.tracking_numbers) ? c.tracking_numbers : [];
          for (const t of tn) {
            if (allTrackings.has(t) && c.invoice_number) {
              trackingToOrder.set(t, c.invoice_number);
            }
          }
        }
      } catch (_) {}
    }

    // Reducir a campos mínimos para no exponer client_snapshot ni otros datos internos
    const minimal = (Array.isArray(orders) ? orders : []).map((o) => ({
      id: o.id,
      order_number: o.order_number,
      status: o.status,
      dispatched_date: o.dispatched_date,
      dispatched_confirmed_date: o.dispatched_confirmed_date,
      created_date: o.created_date,
      notes: o.notes,
      items: (Array.isArray(o.items) ? o.items : []).map((it) => ({
        tracking_number: it.tracking_number,
        consolidation_tracking: it.consolidation_tracking,
        description: it.description,
        cbm_order_number: it.tracking_number ? (trackingToOrder.get(it.tracking_number) || '') : '',
      })),
    }));

    return Response.json({ orders: minimal });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}