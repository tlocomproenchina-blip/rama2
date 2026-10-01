import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { packageCountOfBulto } from "../../shared/dispatchGuideAppend.ts";

// Orden de almacén de una factura pagada.
//
// Arma, a partir de los bultos que esa factura liberó, el resumen que el almacén
// usa para sacar la carga: los bultos agrupados por shipping mark y N° de
// orden/envío, cuántos bultos son de cada orden, la etiqueta de cada bulto, cuántos
// paquetes lleva y el total de bultos.
//
// Los bultos se buscan de las dos formas en que hoy quedan ligados a una factura:
//   1. Bulto.billed_invoice_id = factura (carga facturada desde 'Carga en almacén').
//   2. Bulto.cbm_order_numbers con el N° de orden/envío de la factura, que sale de
//      los recibos incluidos (manual_recibos), los recibos marcados con la factura
//      y los items de envío de las facturas de consolidación.
// Si aun así no aparece nada, se revisan los bultos del cliente y se comparan los
// N° de orden normalizados, por si cambiaron de formato.
//
// El resultado se guarda como snapshot dentro de la factura (Invoice.warehouse_order)
// para que no cambie si luego se editan los bultos; solo se recalcula cuando un admin
// la regenera a propósito. Si no hay bultos vinculados no se guarda una orden vacía.

const text = (value: any) => String(value ?? '').trim();
const norm = (value: any) => text(value).toUpperCase().replace(/^0+(?=\d)/, '');
const NO_ORDER = 'Sin N° de orden';

// N° de orden/envío (invoice_number de CbmIngreso) que cubre la factura.
function invoiceOrderNumbers(invoice: any, receipts: any[]) {
  const numbers = new Set<string>();
  const push = (value: any) => {
    const n = text(value);
    if (n && n !== '—') numbers.add(n);
  };

  for (const recibo of Array.isArray(invoice.manual_recibos) ? invoice.manual_recibos : []) {
    push(recibo?.invoice_number);
  }
  for (const recibo of receipts) push(recibo?.invoice_number);

  for (const item of Array.isArray(invoice.items) ? invoice.items : []) {
    if (!/^env[íi]o/i.test(String(item?.description || ''))) continue;
    const sources = item?.details?.source_invoices;
    if (Array.isArray(sources) && sources.length) sources.forEach(push);
    else push(item?.details?.source_invoice);
  }

  return numbers;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Solo administradores' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const invoiceId = text(body?.invoice_id || body?.invoiceId);
    if (!invoiceId) {
      return Response.json({ error: 'Falta el id de la factura' }, { status: 400 });
    }

    const invoice: any = await base44.asServiceRole.entities.Invoice.get(invoiceId).catch(() => null);
    if (!invoice) {
      return Response.json({ error: 'Factura no encontrada' }, { status: 404 });
    }
    if (invoice.status !== 'pagada') {
      return Response.json({ error: 'La factura todavía no está pagada' }, { status: 400 });
    }

    const receipts: any[] = await base44.asServiceRole.entities.CbmIngreso
      .filter({ billed_invoice_id: invoiceId }, '-fecha', 500)
      .catch(() => []);
    const orderNumbers = invoiceOrderNumbers(invoice, receipts);
    const orderKeys = new Set([...orderNumbers].map(norm));

    const found = new Map<string, any>();
    const add = (list: any[]) => {
      for (const bulto of list) if (bulto?.id) found.set(bulto.id, bulto);
    };

    add(await base44.asServiceRole.entities.Bulto
      .filter({ billed_invoice_id: invoiceId }, '-created_date', 500)
      .catch(() => []));

    if (orderNumbers.size) {
      add(await base44.asServiceRole.entities.Bulto
        .filter({ cbm_order_numbers: { $in: [...orderNumbers] } }, '-created_date', 500)
        .catch(() => []));
    }

    // Un bulto pertenece a la orden si su factura es esta, o si comparte un N° de
    // orden/envío de la factura.
    const belongs = (bulto: any) => {
      if (text(bulto.billed_invoice_id) === invoiceId) return true;
      const own = Array.isArray(bulto.cbm_order_numbers) ? bulto.cbm_order_numbers : [];
      return own.some((value: any) => orderKeys.has(norm(value)));
    };

    let bultos = [...found.values()].filter(belongs);

    if (!bultos.length && invoice.client_email) {
      const delCliente: any[] = await base44.asServiceRole.entities.Bulto
        .filter({ client_email: invoice.client_email }, '-created_date', 500)
        .catch(() => []);
      bultos = delCliente.filter((bulto: any) => {
        const own = Array.isArray(bulto.cbm_order_numbers) ? bulto.cbm_order_numbers : [];
        return own.some((value: any) => orderKeys.has(norm(value)));
      });
    }

    if (!bultos.length) {
      return Response.json({ success: true, empty: true, bultos: 0 });
    }

    // Datos del cliente para el encabezado del documento.
    let clientName = '';
    let shippingMark = '';
    try {
      const users: any[] = await base44.asServiceRole.entities.User
        .filter({ email: invoice.client_email }, '-updated_date', 1);
      const u = users?.[0];
      if (u) {
        clientName = text(u.full_name) || `${text(u.first_name)} ${text(u.last_name)}`.trim();
        shippingMark = text(u.shipping_mark);
      }
    } catch (_) {
      // El encabezado cae al shipping mark de los propios bultos.
    }

    const groups = new Map<string, any>();
    const uniqueBultos = new Map<string, number>();

    bultos.forEach((bulto) => {
      const label = text(bulto.label_code) || `Bulto ${bulto.bulto_number ?? ''}`.trim();
      const mark = text(bulto.shipping_mark) || shippingMark;
      const packageCount = packageCountOfBulto(bulto);
      const ownOrders = [...new Set(
        (Array.isArray(bulto.cbm_order_numbers) ? bulto.cbm_order_numbers : [])
          .map(text)
          .filter(Boolean)
      )];
      const fromInvoice = ownOrders.filter((order) => orderKeys.has(norm(order)));
      const orderList = fromInvoice.length ? fromInvoice : (ownOrders.length ? ownOrders : [NO_ORDER]);

      uniqueBultos.set(bulto.id, packageCount);

      const bultoEntry = {
        label_code: label,
        bulto_number: bulto.bulto_number ?? null,
        is_caja: !!bulto.is_caja,
        caja_number: bulto.caja_number ?? null,
        caja_total: bulto.caja_total ?? null,
        package_count: packageCount,
        status: text(bulto.status),
      };

      for (const order of orderList) {
        const key = `${norm(mark)}|${norm(order)}`;
        let group = groups.get(key);
        if (!group) {
          group = { shipping_mark: mark, order_number: order, bultos_count: 0, packages_count: 0, bultos: [] };
          groups.set(key, group);
        }
        group.bultos.push(bultoEntry);
        group.bultos_count += 1;
        group.packages_count += packageCount;
      }
    });

    const groupList = [...groups.values()].sort((a, b) =>
      String(a.shipping_mark).localeCompare(String(b.shipping_mark))
      || String(a.order_number).localeCompare(String(b.order_number), 'es', { numeric: true })
    );

    const now = new Date().toISOString();
    const previous: any = invoice.warehouse_order || null;

    const order: any = {
      generated_date: now,
      generated_by: user.email,
      client_name: clientName || invoice.client_email || '',
      shipping_mark: shippingMark || groupList[0]?.shipping_mark || '',
      groups: groupList,
      totals: {
        groups: groupList.length,
        bultos: uniqueBultos.size,
        packages: [...uniqueBultos.values()].reduce((sum, count) => sum + (Number(count) || 0), 0),
      },
    };

    if (previous?.generated_date) {
      order.regenerated_date = now;
      order.regenerated_by = user.email;
    }

    await base44.asServiceRole.entities.Invoice.update(invoiceId, { warehouse_order: order });

    return Response.json({ success: true, order, bultos: order.totals.bultos });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}