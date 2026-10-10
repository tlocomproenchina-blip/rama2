// Órdenes que se generan solas al emitir una guía a mano.
//
// Por cada cliente de la guía se crea su orden de despacho por la MISMA vía que usa
// el almacén al despachar (createDispatchOrder): así el número de orden, la
// agrupación con las órdenes del mismo día y el marcado de recibos disponibles para
// entrega quedan idénticos al flujo que ya funciona. Los ítems salen de los bultos
// de la guía: cada tracking registrado en el bulto es un ítem y, si el bulto todavía
// no tiene trackings, entra con su propio código para que el almacén no pierda la
// unidad que debe sacar.
//
// El resumen queda guardado en la guía (DispatchGuide.dispatch_orders) para poder
// consultar la guía junto con sus órdenes desde el historial.
//
// La usa la emisión manual de guías (createDispatchGuide con with_orders).

const text = (value: any) => String(value ?? '').trim();

// Ítems de la orden a partir de los bultos seleccionados.
function itemsOfBultos(codes: string[], bultos: any[]) {
  const byCode = new Map<string, any>();
  bultos.forEach((bulto) => byCode.set(text(bulto?.label_code).toUpperCase(), bulto));

  const items: any[] = [];
  codes.forEach((code) => {
    const bulto = byCode.get(code.toUpperCase());
    const trackings = [
      ...new Set(
        (Array.isArray(bulto?.package_trackings) ? bulto.package_trackings : [])
          .map((t: any) => text(t))
          .filter(Boolean)
      ),
    ];

    if (!trackings.length) {
      items.push({
        tracking_number: code,
        description: 'Bulto sin tracking registrado',
        consolidation_tracking: '',
        bulto_label_code: code,
      });
      return;
    }

    trackings.forEach((tracking) => {
      items.push({
        tracking_number: tracking,
        description: text(bulto?.description),
        consolidation_tracking: '',
        bulto_label_code: code,
      });
    });
  });

  return items;
}

// Ítems de una línea sin bulto registrado: la carga se emite por su N° de orden.
// Si el recibo trae trackings, cada uno entra como paquete real de la orden; si no,
// la línea entra con la referencia de la orden para que el almacén la ubique.
function itemsOfUnregistered(lines: any[]) {
  const items: any[] = [];

  (Array.isArray(lines) ? lines : []).forEach((line) => {
    const order = text(line?.order_number);
    const description = `Carga sin bulto registrado${order ? ` · Orden/Envío ${order}` : ''}`;
    const trackings = [
      ...new Set(
        (Array.isArray(line?.tracking_numbers) ? line.tracking_numbers : [])
          .map((tracking: any) => text(tracking))
          .filter(Boolean)
      ),
    ];

    if (!trackings.length) {
      items.push({
        tracking_number: order ? `ORDEN ${order}` : 'CARGA SIN BULTO',
        description,
        consolidation_tracking: order,
        bulto_label_code: '',
      });
      return;
    }

    trackings.forEach((tracking) => {
      items.push({
        tracking_number: tracking,
        description,
        consolidation_tracking: order,
        bulto_label_code: '',
      });
    });
  });

  return items;
}

// Crea la orden de cada cliente de la guía y devuelve su resumen.
// Un cliente sin email no se puede emitir por esta vía: se reporta en `failed`
// para que el admin lo genere a mano, sin frenar el resto de la guía.
export async function createOrdersForGuide(base44: any, { guide, user }: any) {
  const clients = Array.isArray(guide?.clients) ? guide.clients : [];
  const orders: any[] = [];
  const failed: any[] = [];

  for (const client of clients) {
    const clientEmail = text(client?.client_email);
    const lines = Array.isArray(client?.bultos) ? client.bultos : [];
    const codes = lines.map((line: any) => text(line?.label_code)).filter(Boolean);
    // Líneas de carga sin bulto registrado (emitidas por su N° de orden / envío).
    const unregistered = lines.filter((line: any) => line?.unregistered || !text(line?.label_code));

    if (!clientEmail || !lines.length) {
      failed.push({
        client: text(client?.client_name) || clientEmail,
        reason: !clientEmail ? 'El cliente no tiene email registrado' : 'Sin carga',
      });
      continue;
    }

    const bultos: any[] = codes.length
      ? await base44.asServiceRole.entities.Bulto
          .filter({ label_code: { $in: codes } }, '-created_date', 500)
          .catch(() => [])
      : [];

    const snapshot = client?.client || {};
    const clientName = text(client?.client_name) || text(snapshot?.full_name) || clientEmail;

    try {
      const res: any = await base44.functions.invoke('createDispatchOrder', {
        client_email: clientEmail,
        client_name: clientName,
        shipping_mark: text(client?.shipping_mark) || text(snapshot?.shipping_mark),
        client_snapshot: { ...snapshot, email: text(snapshot?.email) || clientEmail },
        items: [...itemsOfBultos(codes, bultos), ...itemsOfUnregistered(unregistered)],
        notes: `Guía ${text(guide?.guide_number)} · emisión manual`,
      });

      const order = res?.data?.order || res?.order;
      if (!order?.order_number) throw new Error('No se pudo crear la orden de despacho');

      orders.push({
        client_email: clientEmail,
        client_name: clientName,
        shipping_mark: text(client?.shipping_mark) || text(snapshot?.shipping_mark),
        order_id: text(order?.id),
        order_number: text(order?.order_number),
        bultos_count: lines.length,
        packages_count: Number(client?.totals?.packages) || 0,
        cbm: Number(client?.totals?.cbm) || 0,
        emitted_by: text(user?.email),
      });
    } catch (error: any) {
      failed.push({
        client: clientName,
        reason: text(error?.message) || 'No se pudo crear la orden de despacho',
      });
    }
  }

  if (orders.length) {
    await base44.asServiceRole.entities.DispatchGuide
      .update(guide.id, { dispatch_orders: orders })
      .catch(() => null);
  }

  return { orders, failed };
}