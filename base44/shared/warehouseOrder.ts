// Orden de almacén de una factura pagada.
//
// Arma, a partir de los bultos que esa factura liberó, el resumen que el almacén
// usa para sacar la carga: los bultos agrupados por shipping mark y N° de
// contenedor, cuántos bultos son de cada contenedor, la etiqueta de cada bulto, cuántos
// paquetes lleva y el total de bultos.
//
// Los bultos se buscan de las dos formas en que hoy quedan ligados a una factura:
//   1. Bulto.billed_invoice_id = factura (carga facturada desde 'Carga en almacén').
//   2. Bulto.cbm_order_numbers con el N° de contenedor de la factura, que sale de
//      los recibos incluidos (manual_recibos), los recibos marcados con la factura
//      y los items de envío de las facturas de consolidación.
// Si aun así no aparece nada, se revisan los bultos del cliente y se comparan los
// N° de contenedor normalizados, por si cambiaron de formato.
//
// El resultado se guarda como snapshot dentro de la factura (Invoice.warehouse_order)
// para que no cambie si luego se editan los bultos; solo se recalcula cuando un admin
// la regenera a propósito. Si no hay bultos vinculados no se guarda una orden vacía.
//
// La usan la función generateWarehouseOrder (generación y regeneración a mano desde
// Gestión de Facturas) y todas las vías en que una factura queda pagada sin que un
// admin la marque a mano: aprobación de abonos, pagos reportados, pagos de
// consolidación y pago en línea del cliente con PayPal.

import { packageCountOfBulto } from "./dispatchGuideAppend.ts";

const text = (value: any) => String(value ?? '').trim();
const norm = (value: any) => text(value).toUpperCase().replace(/^0+(?=\d)/, '');
const NO_ORDER = 'Sin N° de contenedor';

// N° de contenedor (invoice_number de CbmIngreso) que cubre la factura.
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

// Aviso in-app a los admins: la factura quedó pagada pero todavía no tiene bultos
// vinculados, así que no hay orden de almacén que guardar y hay que generarla luego
// a mano desde su fila en Gestión de Facturas.
async function notifyAdminsMissingOrder(base44: any, invoice: any) {
  try {
    const admins = await base44.asServiceRole.entities.User
      .filter({ role: 'admin' })
      .catch(() => []);
    const emails = [...new Set((admins || []).map((a: any) => text(a.email)).filter(Boolean))];
    if (!emails.length) return;

    await base44.asServiceRole.entities.Notification.bulkCreate(emails.map((email: string) => ({
      user_email: email,
      title: '⚠️ Factura pagada sin orden de almacén',
      message: `La factura ${text(invoice.invoice_number) || invoice.id} quedó pagada, pero todavía no tiene bultos vinculados. Genera su orden de almacén desde Gestión de Facturas cuando el almacén cierre los bultos.`,
      type: 'payment_validation',
      icon: 'alert',
      priority: 'high',
      reference_id: invoice.id,
      entity_type: 'Invoice',
      read: false,
    })));
  } catch (_) {
    // El aviso es informativo: si falla, el pago y la factura siguen intactos.
  }
}

// Construye la orden de almacén de una factura pagada y la guarda dentro de ella.
// Devuelve:
//   { skipped: 'not_found' }      la factura no existe
//   { skipped: 'not_paid' }       la factura todavía no está pagada
//   { skipped: 'exists', order }  ya tenía orden y no se pidió regenerarla
//   { empty: true, bultos: 0 }    no hay bultos vinculados: no se guarda orden vacía
//   { order, bultos }             orden armada y guardada
export async function buildWarehouseOrder(base44: any, invoiceId: string, options: any = {}) {
  const generatedBy = text(options?.generatedBy);
  const force = !!options?.force;

  const invoice: any = await base44.asServiceRole.entities.Invoice.get(invoiceId).catch(() => null);
  if (!invoice) return { skipped: 'not_found' };
  if (invoice.status !== 'pagada') return { skipped: 'not_paid' };

  // Nunca se pisa una orden ya guardada de forma automática: solo el admin la
  // regenera a propósito (force).
  if (invoice.warehouse_order && !force) return { skipped: 'exists', order: invoice.warehouse_order };

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
  // contenedor de la factura.
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
    return { empty: true, bultos: 0, id: invoice.id, invoice_number: invoice.invoice_number || '' };
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
    generated_by: generatedBy,
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
    order.regenerated_by = generatedBy;
  }

  await base44.asServiceRole.entities.Invoice.update(invoiceId, { warehouse_order: order });

  return { order, bultos: order.totals.bultos };
}

// Vía automática: se llama en el momento en que la factura acaba de quedar pagada
// por cualquiera de los caminos de pago (aprobación de abono o pago reportado, pago
// de consolidación y pago en línea del cliente). Nunca rompe el pago: si algo falla
// o la factura aún no tiene bultos, el admin puede generar la orden desde su fila en
// Gestión de Facturas.
export async function buildWarehouseOrderOnPayment(base44: any, invoiceId: string, generatedBy: string) {
  try {
    const result: any = await buildWarehouseOrder(base44, invoiceId, { generatedBy, force: false });
    if (result?.empty) await notifyAdminsMissingOrder(base44, result);
    return result;
  } catch (_) {
    return { skipped: 'error' };
  }
}