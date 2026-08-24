import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Uso único (manual, sin calendario): genera guías de despacho 'emitida' para
// todos los paquetes con updated_date de hoy (zona Caracas), en cualquier estado
// (excepto 'despachado' para no duplicar), agrupados por cliente, sin requerir
// CBMs. Reutiliza la lógica de agrupación por día y fusión de trackings de
// createDispatchOrder, omitiendo la validación de 90 días de tránsito.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // 1. Calcular el rango de "hoy" en zona Caracas (UTC-4) expresado en UTC.
    const caracasOffsetMs = -4 * 60 * 60 * 1000;
    const now = new Date();
    const caracasNow = new Date(now.getTime() + caracasOffsetMs);
    const y = caracasNow.getUTCFullYear();
    const m = caracasNow.getUTCMonth();
    const d = caracasNow.getUTCDate();
    const startTodayMs = Date.UTC(y, m, d, 0, 0, 0) - caracasOffsetMs;
    const endTodayMs = startTodayMs + 24 * 60 * 60 * 1000;

    // 2. Paginar Package ordenado por -updated_date y filtrar JS-side por
    //    updated_date dentro de hoy. El SDK no soporta $gte/$lte en
    //    updated_date nativamente.
    const BATCH = 500;
    let skip = 0;
    const todayPackages = [];
    while (skip < 20000) {
      const batch = await base44.asServiceRole.entities.Package.list('-updated_date', BATCH, skip);
      if (!batch || batch.length === 0) break;
      let stop = false;
      for (const p of batch) {
        if (!p?.updated_date) continue;
        const t = new Date(p.updated_date).getTime();
        if (t < startTodayMs) { stop = true; break; }
        if (t >= startTodayMs && t < endTodayMs) {
          if (p.status !== 'despachado' && p.client_email) todayPackages.push(p);
        }
      }
      if (stop) break;
      if (batch.length < BATCH) break;
      skip += BATCH;
    }

    if (todayPackages.length === 0) {
      return Response.json({
        summary: { created: 0, updated: 0, packages: 0, clients: 0, message: 'No hay paquetes modificados hoy.' }
      });
    }

    // 3. Agrupar por client_email
    const byClient = new Map();
    for (const p of todayPackages) {
      const email = String(p.client_email);
      if (!byClient.has(email)) byClient.set(email, []);
      byClient.get(email).push({
        tracking_number: p.tracking_number || '',
        description: p.description || '',
        consolidation_tracking: p.consolidation_tracking || '',
      });
    }

    // 4. Cargar snapshots de clientes (User) en lote por email.
    const emails = Array.from(byClient.keys());
    const usersMap = new Map();
    if (emails.length > 0) {
      let uskip = 0;
      while (uskip < 10000) {
        const ub = await base44.asServiceRole.entities.User.list('-created_date', 500, uskip).catch(() => []);
        if (!ub || ub.length === 0) break;
        for (const u of ub) {
          if (u?.email && emails.includes(u.email)) usersMap.set(u.email, u);
        }
        if (ub.length < 500) break;
        uskip += 500;
      }
    }

    // 5. Pre-cargar órdenes 'emitida' existentes de los clientes involucrados.
    const existingOrdersByClient = new Map();
    for (const email of emails) {
      const existing = await base44.asServiceRole.entities.DispatchOrder.filter(
        { client_email: email, status: 'emitida' },
        '-created_date',
        50
      ).catch(() => []);
      existingOrdersByClient.set(email, existing || []);
    }

    // 6. Secuencia base para order_number OD-YYYYMMDD-NNNN
    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const datePart = `${today.getFullYear()}${pad(today.getMonth() + 1)}${pad(today.getDate())}`;
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    let baseSequence = 0;
    {
      let s = 0;
      while (s < 5000) {
        const batch = await base44.asServiceRole.entities.DispatchOrder.list('-created_date', 200, s);
        if (!batch || batch.length === 0) break;
        baseSequence += batch.filter((o) => String(o.order_number || '').startsWith(`OD-${datePart}`)).length;
        if (batch.length < 200) break;
        s += 200;
      }
    }

    let created = 0;
    let updated = 0;
    let seq = baseSequence;
    const clientResults = [];

    for (const email of emails) {
      const newItems = byClient.get(email);
      const client = usersMap.get(email);
      const clientName = client?.full_name || email;
      const shippingMark = newItems[0]?.consolidation_tracking ? '' : (client?.shipping_mark || '');
      // shipping_mark del cliente (no del paquete, que no lo tiene)
      const sm = client?.shipping_mark || '';
      const snapshot = {
        full_name: client?.full_name || '',
        email: client?.email || email,
        cedula: client?.cedula || '',
        whatsapp: client?.whatsapp || '',
        address: client?.address || '',
        city: client?.city || '',
        state: client?.state || '',
        shipping_mark: client?.shipping_mark || '',
      };

      const existingOrders = existingOrdersByClient.get(email) || [];
      const newTrackings = new Set(newItems.map((i) => i.tracking_number).filter(Boolean));

      // Prioridad 1: orden 'emitida' existente con tracking duplicado
      const orderWithDup = existingOrders.find((o) =>
        (o.items || []).some((i) => i.tracking_number && newTrackings.has(i.tracking_number))
      );

      if (orderWithDup) {
        const existingTrackings = new Set((orderWithDup.items || []).map((i) => i.tracking_number));
        const itemsToAdd = newItems.filter((i) => !existingTrackings.has(i.tracking_number));
        if (itemsToAdd.length > 0) {
          const merged = [...(orderWithDup.items || []), ...itemsToAdd];
          await base44.asServiceRole.entities.DispatchOrder.update(orderWithDup.id, { items: merged });
          updated++;
          clientResults.push({ client: clientName, order_number: orderWithDup.order_number, action: 'actualizada', added: itemsToAdd.length });
        } else {
          clientResults.push({ client: clientName, order_number: orderWithDup.order_number, action: 'sin_cambios', added: 0 });
        }
        continue;
      }

      // Prioridad 2: orden 'emitida' del mismo día
      const matchingOrder = existingOrders.find((o) => {
        const od = o.dispatched_date ? new Date(o.dispatched_date) : (o.created_date ? new Date(o.created_date) : null);
        if (!od) return false;
        const os = `${od.getFullYear()}-${pad(od.getMonth() + 1)}-${pad(od.getDate())}`;
        return os === todayStr;
      });

      if (matchingOrder) {
        const existingTrackings = new Set((matchingOrder.items || []).map((i) => i.tracking_number));
        const itemsToAdd = newItems.filter((i) => !existingTrackings.has(i.tracking_number));
        if (itemsToAdd.length > 0) {
          const merged = [...(matchingOrder.items || []), ...itemsToAdd];
          await base44.asServiceRole.entities.DispatchOrder.update(matchingOrder.id, { items: merged });
          updated++;
          clientResults.push({ client: clientName, order_number: matchingOrder.order_number, action: 'actualizada', added: itemsToAdd.length });
        } else {
          clientResults.push({ client: clientName, order_number: matchingOrder.order_number, action: 'sin_cambios', added: 0 });
        }
        continue;
      }

      // Crear nueva orden
      seq++;
      let orderNumber = `OD-${datePart}-${String(seq).padStart(4, '0')}`;
      const exists = await base44.asServiceRole.entities.DispatchOrder.filter({ order_number: orderNumber }, '-created_date', 1);
      if (exists?.length) {
        orderNumber = `OD-${datePart}-${String(seq).padStart(4, '0')}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
      }

      const orderData = {
        order_number: orderNumber,
        client_email: email,
        client_name: clientName,
        shipping_mark: sm,
        client_snapshot: snapshot,
        items: newItems,
        status: 'emitida',
        dispatched_date: new Date().toISOString(),
        created_by_email: user.email,
        notes: 'Generada automáticamente (paquetes modificados hoy)',
      };

      const createdOrder = await base44.asServiceRole.entities.DispatchOrder.create(orderData);
      created++;
      clientResults.push({ client: clientName, order_number: orderNumber, action: 'creada', added: newItems.length, order_id: createdOrder?.id });
    }

    return Response.json({
      summary: {
        created,
        updated,
        packages: todayPackages.length,
        clients: byClient.size,
        message: `${created} órdenes creadas, ${updated} actualizadas para ${byClient.size} clientes (${todayPackages.length} paquetes).`
      },
      details: clientResults
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}