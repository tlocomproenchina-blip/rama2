import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

// Backfill admin-only: recorre todas las DispatchOrders con items vacíos,
// busca los paquetes despachados (status='despachado') de ese cliente en la
// fecha de la orden, reconstruye los items con los tracking numbers encontrados,
// y actualiza la orden. Retorna un resumen de cuántas órdenes fueron reparadas.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    // 1) Listar todas las DispatchOrders paginando hasta encontrar todas con items vacíos
    const batchSize = 200;
    let skip = 0;
    const emptyOrders: any[] = [];

    while (true) {
      const batch = await base44.asServiceRole.entities.DispatchOrder.list('-created_date', batchSize, skip);
      if (!batch || batch.length === 0) break;

      const empty = batch.filter((o: any) => !o.items || o.items.length === 0);
      emptyOrders.push(...empty);

      if (batch.length < batchSize) break;
      skip += batchSize;
      if (skip >= 5000) break; // tope de seguridad
    }

    let repaired = 0;
    let notFound = 0;
    const details: any[] = [];

    for (const order of emptyOrders) {
      const orderDate = order.dispatched_date
        ? new Date(order.dispatched_date)
        : (order.created_date ? new Date(order.created_date) : null);

      if (!orderDate) {
        notFound++;
        details.push({ order_number: order.order_number, status: 'no_date' });
        continue;
      }

      // Buscar paquetes despachados de este cliente (mismo día)
      const startOfDay = new Date(orderDate);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(orderDate);
      endOfDay.setUTCHours(23, 59, 59, 999);

      let packages: any[] = [];
      try {
        packages = await base44.asServiceRole.entities.Package.filter(
          { client_email: order.client_email, status: 'despachado' },
          '-dispatched_date',
          500
        );
      } catch (_) {}

      const dayPackages = packages.filter((p) => {
        if (!p.dispatched_date) return false;
        const d = new Date(p.dispatched_date);
        return d >= startOfDay && d <= endOfDay;
      });

      if (dayPackages.length === 0) {
        notFound++;
        details.push({ order_number: order.order_number, status: 'no_packages', client: order.client_email });
        continue;
      }

      // Reconstruir items con los tracking numbers encontrados
      const items = dayPackages.map((p) => ({
        tracking_number: p.tracking_number || '',
        description: p.description || '',
        consolidation_tracking: '',
      }));

      try {
        await base44.asServiceRole.entities.DispatchOrder.update(order.id, { items });
        repaired++;
        details.push({ order_number: order.order_number, status: 'repaired', items_count: items.length, client: order.client_email });
      } catch (e) {
        notFound++;
        details.push({ order_number: order.order_number, status: 'update_failed', error: e?.message || '' });
      }
    }

    return Response.json({
      success: true,
      total_empty: emptyOrders.length,
      repaired,
      not_found: notFound,
      details,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}