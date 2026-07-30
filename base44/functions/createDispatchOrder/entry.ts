import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Genera el número de orden de despacho en el servidor para garantizar
// que sea único, y crea el registro de la orden.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { client_email, client_name, shipping_mark, client_snapshot, items, notes } = body;
    if (!client_email) return Response.json({ error: 'client_email es requerido' }, { status: 400 });

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
      items: Array.isArray(items) ? items : [],
      status: 'emitida',
      dispatched_date: now.toISOString(),
      created_by_email: user.email,
      notes: notes || '',
    };

    const created = await base44.asServiceRole.entities.DispatchOrder.create(orderData);
    return Response.json({ order: { ...orderData, id: created?.id } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}