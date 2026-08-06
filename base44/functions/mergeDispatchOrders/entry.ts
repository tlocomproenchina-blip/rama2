import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Fusiona múltiples órdenes de despacho "emitida" del mismo cliente en una sola.
// La orden más antigua se conserva como destino; las demás se eliminan.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { order_ids } = body;
    if (!Array.isArray(order_ids) || order_ids.length < 2) {
      return Response.json({ error: 'Selecciona al menos 2 órdenes para fusionar' }, { status: 400 });
    }

    // Cargar todas las órdenes
    const orders = [];
    for (const id of order_ids) {
      const o = await base44.asServiceRole.entities.DispatchOrder.get(id).catch(() => null);
      if (o) orders.push(o);
    }

    if (orders.length < 2) {
      return Response.json({ error: 'No se pudieron cargar todas las órdenes' }, { status: 400 });
    }

    // Validar que todas son del mismo cliente y están "emitida"
    const clientEmail = orders[0].client_email;
    const allSameClient = orders.every((o) => o.client_email === clientEmail);
    if (!allSameClient) {
      return Response.json({ error: 'Solo se pueden fusionar órdenes del mismo cliente' }, { status: 400 });
    }

    const allEmitida = orders.every((o) => o.status === 'emitida');
    if (!allEmitida) {
      return Response.json({ error: 'Solo se pueden fusionar órdenes en estado "emitida"' }, { status: 400 });
    }

    // Ordenar por fecha: la más antigua será la orden destino
    orders.sort((a, b) => {
      const da = new Date(a.dispatched_date || a.created_date || 0).getTime();
      const db = new Date(b.dispatched_date || b.created_date || 0).getTime();
      return da - db;
    });

    const targetOrder = orders[0];
    const sourceOrders = orders.slice(1);

    // Combinar todos los items, evitando duplicados por tracking_number
    const existingTrackings = new Set((targetOrder.items || []).map((i) => i.tracking_number));
    const allItems = [...(targetOrder.items || [])];
    let added = 0;

    for (const src of sourceOrders) {
      for (const item of (src.items || [])) {
        if (item.tracking_number && !existingTrackings.has(item.tracking_number)) {
          allItems.push(item);
          existingTrackings.add(item.tracking_number);
          added++;
        }
      }
    }

    // Actualizar la orden destino con todos los items combinados
    await base44.asServiceRole.entities.DispatchOrder.update(targetOrder.id, { items: allItems });

    // Eliminar las órdenes fuente
    for (const src of sourceOrders) {
      await base44.asServiceRole.entities.DispatchOrder.delete(src.id).catch(() => {});
    }

    return Response.json({
      order: { ...targetOrder, items: allItems },
      merged: sourceOrders.length,
      added
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}