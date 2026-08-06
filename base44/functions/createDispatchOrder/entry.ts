import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Genera el número de orden de despacho en el servidor para garantizar
// que sea único, y crea el registro de la orden.
// Si ya existe una orden "emitida" para el mismo cliente con el mismo recibo
// (consolidation_tracking), agrega los nuevos paquetes a esa orden en lugar
// de crear una nueva.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { client_email, client_name, shipping_mark, client_snapshot, items, notes } = body;
    if (!client_email) return Response.json({ error: 'client_email es requerido' }, { status: 400 });

    const newItems = Array.isArray(items) ? items : [];

    // Determinar si todos los nuevos items comparten el mismo recibo
    const receipts = [...new Set(newItems.map((i) => (i.consolidation_tracking || '').trim()).filter(Boolean))];

    if (receipts.length === 1) {
      // Todos los items comparten el mismo recibo: buscar una orden "emitida" existente
      // para el mismo cliente que ya tenga items con ese recibo
      const existingOrders = await base44.asServiceRole.entities.DispatchOrder.filter(
        { client_email, status: 'emitida' },
        '-created_date',
        50
      );

      const matchingOrder = existingOrders?.find(
        (o) => Array.isArray(o.items) && o.items.some((i) => (i.consolidation_tracking || '').trim() === receipts[0])
      );

      if (matchingOrder) {
        // Agregar nuevos items, evitando duplicados por tracking_number
        const existingTrackings = new Set((matchingOrder.items || []).map((i) => i.tracking_number));
        const itemsToAdd = newItems.filter((i) => !existingTrackings.has(i.tracking_number));

        if (itemsToAdd.length > 0) {
          const updatedItems = [...(matchingOrder.items || []), ...itemsToAdd];
          await base44.asServiceRole.entities.DispatchOrder.update(matchingOrder.id, { items: updatedItems });
          return Response.json({ order: { ...matchingOrder, items: updatedItems }, updated: true, added: itemsToAdd.length });
        }
        // Todos los items ya estaban en la orden
        return Response.json({ order: matchingOrder, updated: true, no_change: true });
      }
    }

    // No hay orden existente con ese recibo: crear una nueva
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;

    // Secuencial del día: cuenta las órdenes existentes con el mismo prefijo
    let sequence = 1;
    let skip = 0;
    while (true) {
      const batch = await base44.asServiceRole.entities.DispatchOrder.list('-created_date', 200, skip);
      if (!batch || batch.length === 0) break;
      sequence += batch.filter((o) => String(o.order_number || '').startsWith(`OD-${datePart}`)).length;
      if (batch.length < 200) break;
      skip += 200;
      if (skip >= 5000) break;
    }

    let orderNumber = `OD-${datePart}-${String(sequence).padStart(4, '0')}`;
    const existing = await base44.asServiceRole.entities.DispatchOrder.filter({ order_number: orderNumber }, '-created_date', 1);
    if (existing?.length) {
      orderNumber = `OD-${datePart}-${String(sequence).padStart(4, '0')}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    }

    const orderData = {
      order_number: orderNumber,
      client_email,
      client_name: client_name || client_email,
      shipping_mark: shipping_mark || '',
      client_snapshot: client_snapshot || {},
      items: newItems,
      status: 'emitida',
      dispatched_date: now.toISOString(),
      created_by_email: user.email,
      notes: notes || '',
    };

    const created = await base44.asServiceRole.entities.DispatchOrder.create(orderData);
    return Response.json({ order: { ...orderData, id: created?.id }, updated: false });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}