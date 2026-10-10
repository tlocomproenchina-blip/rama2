import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import {
  caracasDateKey,
  connectionKeyOf,
  connectionLabel,
  listWholesalerConnections,
} from '../../shared/wholesalerCore.ts';
import { errorMessage, fetchAllFilter, num } from '../../shared/paginatedFetch.ts';
import {
  HANDLING_FEE,
  clientAmounts,
  defaultWholesalerName,
  emailKeyOf,
  invoiceEmailHtml,
  loadBilledIndex,
  loadOrdersForClients,
  markKeyOf,
  nextInvoiceNumber,
  orderKeyOf,
  ordersForClient,
  receivedTrackingsByOrder,
  round2,
  sendInvoiceEmail,
  stampKeyOf,
  trackingKeyOf,
} from '../../shared/wholesalerBilling.ts';

// Emite una sola factura con varios clientes de un mayorista: calcula los montos
// de cada cliente con sus tarifas por CBM, su puerta a puerta por CBM y 1 USD por
// cada tracking recibido, guarda la factura, marca lo facturado para no repetirlo
// y le manda a cada cliente su parte por correo.
const EMAIL_BATCH = 6;
const WRITE_BATCH = 200;

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    const isAutomation = req.headers.get('x-base44-automation') === 'true';
    if (!isAutomation && (!user || user.role !== 'admin')) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const requested: any[] = Array.isArray(body?.clients) ? body.clients : [];
    if (!requested.length) {
      return Response.json({ ok: false, error: 'No hay clientes seleccionados para facturar.' });
    }

    // El mayorista queda identificado por la marca de sus clientes, así que
    // sigue sirviendo aunque su conexión se haya quitado después.
    const key = String(body?.wholesaler_key || '').trim() || 'main';
    let wholesalerName = String(body?.wholesaler_name || '').trim();
    if (!wholesalerName) {
      const connections = await listWholesalerConnections(base44);
      const live = connections.find((row: any) => connectionKeyOf(row) === key);
      wholesalerName = live ? connectionLabel(live) : defaultWholesalerName(key);
    }

    const emails = requested.map((row: any) => emailKeyOf(row?.client_email)).filter(Boolean);
    const marks = requested.map((row: any) => markKeyOf(row?.shipping_mark)).filter(Boolean);
    const [billed, orders] = await Promise.all([
      loadBilledIndex(base44, emails),
      loadOrdersForClients(base44, emails, marks),
    ]);

    // N° de orden nuevos: se revisa que no exista ya un registro con ese número.
    const newOrderValues: string[] = [];
    for (const row of requested) {
      for (const item of Array.isArray(row?.orders) ? row.orders : []) {
        if (item?.is_new === true || item?.is_new === 'true') {
          const value = String(item?.order_number || '').trim();
          if (value) newOrderValues.push(value);
        }
      }
    }
    const takenNumbers = new Set<string>();
    if (newOrderValues.length) {
      const found = await fetchAllFilter(
        base44.asServiceRole.entities.CbmIngreso,
        { invoice_number: { $in: [...new Set(newOrderValues)] } },
        '-fecha',
      );
      for (const row of found || []) takenNumbers.add(orderKeyOf(row.invoice_number));
    }

    const invoiceNumber = await nextInvoiceNumber(base44);
    const now = new Date().toISOString();
    const warnings: string[] = [];
    const builtClients: any[] = [];
    const billedThisRun = new Set<string>();
    const newOrders: any[] = [];

    for (const raw of requested) {
      const email = emailKeyOf(raw?.client_email);
      const label = String(raw?.client_name || raw?.client_email || '').trim();
      if (!email) {
        warnings.push('Un cliente llegó sin correo: no se incluyó.');
        continue;
      }
      const clientOrders = ordersForClient(orders, raw?.client_email, raw?.shipping_mark);
      const selected: any[] = [];

      for (const item of Array.isArray(raw?.orders) ? raw.orders : []) {
        const orderKey = orderKeyOf(item?.order_number);
        if (!orderKey || billedThisRun.has(orderKey)) continue;
        const existing = clientOrders.find((order: any) => orderKeyOf(order.invoice_number) === orderKey) || null;
        const wantsNew = item?.is_new === true || item?.is_new === 'true';

        if (!existing && wantsNew) {
          if (takenNumbers.has(orderKey)) {
            warnings.push(`${label}: ya existe un registro con el N° de orden ${item.order_number}: no se incluyó.`);
            continue;
          }
          const cbm = round2(num(item?.cbm));
          const trackings = (Array.isArray(item?.tracking_numbers) ? item.tracking_numbers : [])
            .map((tracking: any) => String(tracking || '').trim())
            .filter(Boolean);
          billedThisRun.add(orderKey);
          selected.push({ order_number: String(item.order_number).trim(), cbm, trackings, is_new: true });
          newOrders.push({
            orderKey,
            order_number: String(item.order_number).trim(),
            cbm,
            trackings,
            email,
            name: label || email,
            mark: String(raw?.shipping_mark || '').trim(),
          });
          continue;
        }

        if (!existing) {
          warnings.push(`${label}: la orden ${item?.order_number} no está registrada en TLEC CARGO: no se incluyó.`);
          continue;
        }
        if (billed.orders.has(orderKey)) {
          warnings.push(`${label}: la orden ${item.order_number} ya estaba facturada: no se incluyó.`);
          continue;
        }
        billedThisRun.add(orderKey);
        const usePayload = !(item?.cbm === undefined || item?.cbm === null || item?.cbm === '');
        // Trackings de la orden más los que se engancharon desde la pantalla: hay
        // órdenes registradas sin su lista de trackings, y el manejo de 1 USD por
        // paquete recibido se cobra sobre lo que realmente llegó.
        const trackings = (Array.isArray(existing.tracking_numbers) ? existing.tracking_numbers : []).slice();
        for (const raw of Array.isArray(item?.tracking_numbers) ? item.tracking_numbers : []) {
          const value = String(raw || '').trim();
          if (!value) continue;
          if (trackings.some((current: any) => trackingKeyOf(current) === trackingKeyOf(value))) continue;
          trackings.push(value);
        }
        selected.push({
          order_number: String(existing.invoice_number).trim(),
          cbm: usePayload ? round2(num(item.cbm)) : round2(num(existing.cbm)),
          trackings,
          is_new: false,
        });
      }

      if (!selected.length) {
        warnings.push(`${label}: no quedó ninguna orden por facturar.`);
        continue;
      }

      const received = await receivedTrackingsByOrder(base44, selected, billed.trackings);
      const orderDetails = selected.map((order: any) => {
        const hit = received[orderKeyOf(order.order_number)] || { count: 0, trackings: [] };
        return {
          order_number: order.order_number,
          cbm: round2(order.cbm),
          trackings_count: order.trackings.length,
          received_trackings: hit.count,
          trackings: hit.trackings,
          is_new: order.is_new,
        };
      });
      const cbm = round2(selected.reduce((sum: number, order: any) => sum + num(order.cbm), 0));
      const trackings = orderDetails.reduce((sum: number, order: any) => sum + num(order.received_trackings), 0);
      const amounts = clientAmounts({
        cbm,
        shippingRate: num(raw?.rate_per_cbm),
        doorRate: num(raw?.door_to_door_per_cbm),
        trackings,
      });

      builtClients.push({
        client_id: String(raw?.client_id || ''),
        client_email: email,
        client_name: label || email,
        shipping_mark: String(raw?.shipping_mark || '').trim(),
        rate_per_cbm: round2(num(raw?.rate_per_cbm)),
        door_to_door_per_cbm: round2(num(raw?.door_to_door_per_cbm)),
        cbm,
        received_trackings: trackings,
        shipping_amount: amounts.shipping,
        door_to_door_amount: amounts.doorToDoor,
        handling_amount: amounts.handling,
        total: amounts.total,
        orders: orderDetails,
        email_status: 'pendiente',
        email_error: null,
        email_sent_date: null,
      });
    }

    if (!builtClients.length) {
      return Response.json({
        ok: false,
        error: warnings[0] || 'Ninguna orden quedó por facturar.',
        warnings,
      });
    }

    const totals = {
      clients: builtClients.length,
      cbm: round2(builtClients.reduce((sum, client) => sum + client.cbm, 0)),
      received_trackings: builtClients.reduce((sum, client) => sum + client.received_trackings, 0),
      shipping: round2(builtClients.reduce((sum, client) => sum + client.shipping_amount, 0)),
      door_to_door: round2(builtClients.reduce((sum, client) => sum + client.door_to_door_amount, 0)),
      handling: round2(builtClients.reduce((sum, client) => sum + client.handling_amount, 0)),
      total: round2(builtClients.reduce((sum, client) => sum + client.total, 0)),
    };

    // La factura queda guardada antes de avisar a nadie: si un correo falla, el
    // lote ya está registrado y el detalle muestra a quién no le llegó.
    const invoice = await base44.asServiceRole.entities.WholesalerInvoice.create({
      invoice_number: invoiceNumber,
      wholesaler_key: key,
      wholesaler_name: wholesalerName,
      emitted_date: now,
      emitted_by: user?.email || '',
      clients: builtClients,
      totals,
      notes: String(body?.notes || '').slice(0, 1000),
      warnings,
      emails_sent: 0,
      emails_failed: 0,
      status: 'sin_envio',
    });

    // Órdenes nuevas: quedan registradas como el N° de orden/envío del cliente.
    const billedRows: any[] = [];
    for (const item of newOrders) {
      try {
        const created = await base44.asServiceRole.entities.CbmIngreso.create({
          fecha: now,
          mes: caracasDateKey().slice(0, 7),
          cbm: item.cbm,
          client_email: item.email,
          client_name: item.name,
          shipping_mark: item.mark,
          invoice_number: item.order_number,
          tracking_numbers: item.trackings,
          descripcion: `Orden registrada al facturar ${invoiceNumber}`,
        });
        billedRows.push({
          item_type: 'orden',
          client_email: item.email,
          item_key: item.orderKey,
          display_key: item.order_number,
          amount: item.cbm,
          description: created?.id || '',
        });
      } catch (_) {
        warnings.push(`${item.name}: no se pudo registrar la orden ${item.order_number}.`);
      }
    }

    // Marca de lo facturado: ni la orden ni el tracking vuelven a ofrecerse.
    for (const client of builtClients) {
      for (const order of client.orders) {
        if (!order.is_new) {
          billedRows.push({
            item_type: 'orden',
            client_email: client.client_email,
            item_key: orderKeyOf(order.order_number),
            display_key: order.order_number,
            amount: round2(order.cbm),
            description: '',
          });
        }
        for (const tracking of order.trackings || []) {
          billedRows.push({
            item_type: 'tracking',
            client_email: client.client_email,
            item_key: trackingKeyOf(tracking),
            display_key: tracking,
            amount: HANDLING_FEE,
            description: order.order_number,
          });
        }
      }
    }

    const stamped = billedRows.map((row) => ({
      ...row,
      wholesaler_key: key,
      wholesaler_name: wholesalerName,
      invoice_id: invoice?.id || '',
      invoice_number: invoiceNumber,
      billed_date: now,
    }));
    for (let i = 0; i < stamped.length; i += WRITE_BATCH) {
      try {
        await base44.asServiceRole.entities.WholesalerBilledItem.bulkCreate(stamped.slice(i, i + WRITE_BATCH));
      } catch (_) {}
    }

    // Las tarifas quedan guardadas en el cliente para la factura siguiente.
    const rateRows = builtClients
      .filter((client) => client.client_id)
      .map((client) => ({
        id: client.client_id,
        rate_per_cbm: client.rate_per_cbm,
        door_to_door_per_cbm: client.door_to_door_per_cbm,
        rates_updated_date: now,
      }));
    if (rateRows.length) {
      try {
        const rows = await fetchAllFilter(
          base44.asServiceRole.entities.WholesalerClient,
          { id: { $in: rateRows.map((row) => row.id) } },
          '-fetched_date',
        );
        const allowed = new Set<string>();
        for (const row of rows || []) {
          if (stampKeyOf(row) === key) allowed.add(row.id);
        }
        const safe = rateRows.filter((row) => allowed.has(row.id));
        if (safe.length) await base44.asServiceRole.entities.WholesalerClient.bulkUpdate(safe);
      } catch (_) {}
    }

    // Cada cliente recibe su parte de la factura en su correo.
    const outcomes: any[] = [];
    for (let i = 0; i < builtClients.length; i += EMAIL_BATCH) {
      const chunk = builtClients.slice(i, i + EMAIL_BATCH);
      const settled = await Promise.all(chunk.map(async (client) => {
        const html = invoiceEmailHtml({ invoiceNumber, emittedDate: now, wholesalerName, client });
        const outcome = await sendInvoiceEmail(base44, { to: client.client_email, invoiceNumber, html });
        return { status: outcome.status, error: outcome.error || null };
      }));
      outcomes.push(...settled);
    }

    let sent = 0;
    let failed = 0;
    const finalClients = builtClients.map((client, index) => {
      const outcome = outcomes[index] || { status: 'omitido', error: null };
      if (outcome.status === 'enviado') sent += 1;
      else if (outcome.status === 'fallido') failed += 1;
      return {
        ...client,
        email_status: outcome.status,
        email_error: outcome.error,
        email_sent_date: outcome.status === 'enviado' ? new Date().toISOString() : null,
      };
    });
    const status = sent > 0 ? (failed > 0 ? 'parcial' : 'enviada') : 'sin_envio';

    if (invoice?.id) {
      try {
        await base44.asServiceRole.entities.WholesalerInvoice.update(invoice.id, {
          clients: finalClients,
          emails_sent: sent,
          emails_failed: failed,
          status,
          warnings,
        });
      } catch (_) {}
    }

    const mensaje = `Factura ${invoiceNumber}: ${totals.clients} cliente(s) por $${totals.total.toFixed(2)}. `
      + `${sent} correo(s) enviado(s)${failed ? `, ${failed} con error` : ''}`
      + `${warnings.length ? ` · ${warnings.length} aviso(s)` : ''}.`;

    return Response.json({
      ok: true,
      invoice_id: invoice?.id || '',
      invoice_number: invoiceNumber,
      totals,
      enviados: sent,
      fallidos: failed,
      warnings,
      clientes: finalClients.map((client) => ({
        client_email: client.client_email,
        client_name: client.client_name,
        total: client.total,
        email_status: client.email_status,
        email_error: client.email_error,
      })),
      mensaje,
    });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}