import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

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

    // Cargar los CbmIngreso del cliente UNA sola vez y reutilizar para:
    // 1) resolver consolidation_tracking faltante en los items
    // 2) marcar recibos como disponibles para entrega
    const clientIngresos = await base44.asServiceRole.entities.CbmIngreso.filter(
      { client_email },
      '-fecha',
      500
    ).catch(() => []);

    // Prevenir items con consolidation_tracking vacío: resolver el recibo
    // (CbmIngreso.invoice_number) para cada tracking faltante, así todas las
    // órdenes quedan con su recibo desde la creación.
    const trackingsMissingRecibo = newItems
      .filter((i) => i.tracking_number && !i.consolidation_tracking)
      .map((i) => String(i.tracking_number).trim())
      .filter(Boolean);

    if (trackingsMissingRecibo.length > 0 && clientIngresos?.length) {
      const trackingToRecibo = {};
      (clientIngresos || []).forEach((ing) => {
        const reciboNum = String(ing.invoice_number || '').trim();
        if (!reciboNum) return;
        const trackings = Array.isArray(ing.tracking_numbers) ? ing.tracking_numbers : [];
        trackings.forEach((t) => {
          const tt = String(t || '').trim().toUpperCase();
          if (tt) trackingToRecibo[tt] = reciboNum;
        });
      });
      newItems.forEach((i) => {
        if (!i.consolidation_tracking && i.tracking_number) {
          const tt = String(i.tracking_number).trim().toUpperCase();
          const recibo = trackingToRecibo[tt];
          if (recibo) i.consolidation_tracking = recibo;
        }
      });
    }

    // Marcar los recibos incluidos en la orden como disponibles para entrega.
    const markRecibosDisponible = async (orderItems) => {
      const reciboNums = Array.from(new Set(
        (orderItems || []).map((i) => i.consolidation_tracking).filter(Boolean).map(String)
      ));
      if (reciboNums.length === 0 || !clientIngresos?.length) return;
      try {
        const toUpdate = (clientIngresos || []).filter((ing) =>
          ing.invoice_number && reciboNums.includes(String(ing.invoice_number))
        );
        await Promise.all(toUpdate.map((ing) =>
          base44.asServiceRole.entities.CbmIngreso.update(ing.id, { disponible_entrega: true })
        ));
      } catch (_) {}
    };

    // Agrupación automática: buscar una orden "emitida" existente para el mismo
    // cliente creada el mismo día. Si existe, agregar los nuevos paquetes a esa orden.
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const existingOrders = await base44.asServiceRole.entities.DispatchOrder.filter(
      { client_email, status: 'emitida' },
      '-created_date',
      50
    );

    // Prioridad 1: buscar si algún tracking de los nuevos items ya existe en
    // una orden "emitida" del cliente (sin importar el día). Si existe, se
    // fusionan ahí los items que no estén duplicados, evitando generar una
    // segunda orden con el mismo número de tracking.
    const newTrackings = new Set(newItems.map((i) => i.tracking_number).filter(Boolean));
    const orderWithDuplicateTracking = existingOrders?.find((o) =>
      (o.items || []).some((i) => i.tracking_number && newTrackings.has(i.tracking_number))
    );

    if (orderWithDuplicateTracking) {
      const existingTrackings = new Set((orderWithDuplicateTracking.items || []).map((i) => i.tracking_number));
      const itemsToAdd = newItems.filter((i) => !existingTrackings.has(i.tracking_number));
      if (itemsToAdd.length > 0) {
        const updatedItems = [...(orderWithDuplicateTracking.items || []), ...itemsToAdd];
        await base44.asServiceRole.entities.DispatchOrder.update(orderWithDuplicateTracking.id, { items: updatedItems });
        await markRecibosDisponible(itemsToAdd);
        return Response.json({ order: { ...orderWithDuplicateTracking, items: updatedItems }, updated: true, added: itemsToAdd.length, merged_duplicate: true });
      }
      return Response.json({ order: orderWithDuplicateTracking, updated: true, no_change: true, merged_duplicate: true });
    }

    // Prioridad 2: agrupar por mismo día (comportamiento existente)
    const matchingOrder = existingOrders?.find((o) => {
      const orderDate = o.dispatched_date ? new Date(o.dispatched_date) : (o.created_date ? new Date(o.created_date) : null);
      if (!orderDate) return false;
      const orderStr = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}-${String(orderDate.getDate()).padStart(2, '0')}`;
      return orderStr === todayStr;
    });

    if (matchingOrder) {
      const existingTrackings = new Set((matchingOrder.items || []).map((i) => i.tracking_number));
      const itemsToAdd = newItems.filter((i) => !existingTrackings.has(i.tracking_number));
      if (itemsToAdd.length > 0) {
        const updatedItems = [...(matchingOrder.items || []), ...itemsToAdd];
        await base44.asServiceRole.entities.DispatchOrder.update(matchingOrder.id, { items: updatedItems });
        await markRecibosDisponible(itemsToAdd);
        return Response.json({ order: { ...matchingOrder, items: updatedItems }, updated: true, added: itemsToAdd.length });
      }
      return Response.json({ order: matchingOrder, updated: true, no_change: true });
    }

    // No hay orden existente con ese recibo: crear una nueva
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const prefix = `OD-${datePart}-`;

    // Secuencial del día: cuenta las órdenes existentes con el mismo prefijo
    // usando list (indexado por created_date) en lotes, con tope de 5000.
    let sequence = 1;
    let skip = 0;
    while (true) {
      const batch = await base44.asServiceRole.entities.DispatchOrder.list('-created_date', 200, skip);
      if (!batch || batch.length === 0) break;
      sequence += batch.filter((o) => String(o.order_number || '').startsWith(prefix)).length;
      if (batch.length < 200) break;
      skip += 200;
      if (skip >= 5000) break;
    }

    let orderNumber = `${prefix}${String(sequence).padStart(4, '0')}`;
    const existing = await base44.asServiceRole.entities.DispatchOrder.filter({ order_number: orderNumber }, '-created_date', 1);
    if (existing?.length) {
      orderNumber = `${prefix}${String(sequence).padStart(4, '0')}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
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
    await markRecibosDisponible(newItems);
    return Response.json({ order: { ...orderData, id: created?.id }, updated: false });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}