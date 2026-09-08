import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Devuelve las órdenes de despacho del cliente autenticado (excluyendo canceladas).
// DispatchOrder tiene RLS de solo lectura para admins, por eso usamos asServiceRole
// y devolvemos solo los campos mínimos del cliente (sin client_snapshot ni datos sensibles).
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
      })),
    }));

    return Response.json({ orders: minimal });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}