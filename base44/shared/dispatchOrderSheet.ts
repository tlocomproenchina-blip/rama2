// Orden de despacho para el almacén, armada por período de pago.
//
// Reúne TODAS las facturas que quedaron pagadas dentro del rango de fechas elegido
// (Invoice.status = 'pagada' con payment_date dentro del período) y arma el documento
// que el operador del almacén usa para sacar la carga: los clientes agrupados por
// ciudad y shipping mark, el N° de orden/envío pagado y, dentro de cada orden, cuántas
// cajas consolidadas y bultos sueltos le corresponden. Sin códigos de bulto: el almacén
// solo necesita saber qué cliente, qué orden y cuántas unidades.
//
// Los bultos y cajas se buscan por las mismas dos vías en que quedan ligados a una
// factura (ver shared/warehouseOrder.ts):
//   1. Bulto.billed_invoice_id = factura (carga facturada desde 'Carga en almacén').
//   2. Bulto.cbm_order_numbers con el N° de orden/envío de la factura, que sale de los
//      recibos incluidos (manual_recibos), los recibos marcados con la factura y los
//      items de envío de las facturas de consolidación.
//
// El resultado se guarda como snapshot en DispatchOrderSheet: un registro por rango de
// fechas. Si el rango ya tiene orden guardada se reutiliza tal cual, y solo se recalcula
// cuando un admin la regenera a propósito (force): la misma orden nunca se duplica y lo
// que el almacén ya recibió no cambia solo.
//
// La usan la función getDispatchOrderSheet (pantalla Orden de Despacho y descarga TXT).

import { packageCountOfBulto } from "./dispatchGuideAppend.ts";
import { fetchAllFilter } from "./paginatedFetch.ts";

const text = (value: any) => String(value ?? '').trim();
const unique = (list: any[]) => [...new Set((list || []).map((v) => text(v)).filter(Boolean))];
const norm = (value: any) => text(value).toUpperCase().replace(/^0+(?=\d)/, '');
const NO_ORDER = 'Sin N° de orden';
const NO_CITY = 'Sin ciudad';
const NO_MARK = 'Sin shipping mark';
const IN_CHUNK = 80;

// Venezuela es UTC-4 todo el año: un día de Caracas empieza a las 04:00 UTC.
const CARACAS_UTC_HOUR = 4;

export const isDayKey = (value: any) => /^\d{4}-\d{2}-\d{2}$/.test(text(value));

// Límites ISO del período de días de Caracas (desde inclusive, hasta inclusive).
export function caracasRange(from: string, to: string) {
  const start = new Date(`${from}T0${CARACAS_UTC_HOUR}:00:00.000Z`);
  const end = new Date(`${to}T0${CARACAS_UTC_HOUR}:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return { fromIso: start.toISOString(), toIso: end.toISOString() };
}

function fmtDay(value: any) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text(value));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : text(value);
}

function fmtStamp(value: any) {
  const date = new Date(text(value));
  if (!text(value) || Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es-VE', {
    timeZone: 'America/Caracas',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

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

// Consulta por lista de valores, en lotes: $in no admite listas enormes.
async function filterByIn(entity: any, field: string, values: string[], sort: any) {
  const out: any[] = [];
  for (let i = 0; i < values.length; i += IN_CHUNK) {
    const batch = await fetchAllFilter(entity, { [field]: { $in: values.slice(i, i + IN_CHUNK) } }, sort)
      .catch(() => []);
    out.push(...batch);
  }
  return out;
}

// Datos del cliente (ciudad, nombre, shipping mark): se piden por la vía que ya usa el
// resto del sistema para no quedarse corto en la base de usuarios.
async function loadClients(base44: any, emails: string[]) {
  if (!emails.length) return {} as Record<string, any>;
  try {
    const res: any = await base44.asServiceRole.functions.invoke('getClientsByEmails', { emails });
    return res?.clients || res?.data?.clients || {};
  } catch (_) {
    return {} as Record<string, any>;
  }
}

export async function loadDispatchOrderConfig(base44: any) {
  const rows: any[] = await base44.asServiceRole.entities.DispatchOrderConfig
    .filter({ config_key: 'main' }, '-updated_date', 1)
    .catch(() => []);
  return rows?.[0] || null;
}

async function findSheet(base44: any, from: string, to: string) {
  const rows: any[] = await base44.asServiceRole.entities.DispatchOrderSheet
    .filter({ period_from: from, period_to: to }, '-generated_date', 1)
    .catch(() => []);
  return rows?.[0] || null;
}

// Cuenta cajas, bultos sueltos, unidades y paquetes de un conjunto de unidades.
function countUnits(units: Map<string, any>) {
  let cajas = 0;
  let bultos = 0;
  let packages = 0;
  for (const unit of units.values()) {
    if (unit.kind === 'caja') cajas += 1;
    else bultos += 1;
    packages += Number(unit.package_count) || 0;
  }
  return {
    cajas,
    bultos_sueltos: bultos,
    total_unidades: units.size,
    packages: Math.round(packages * 100) / 100,
  };
}

// Arma (o regenera) la orden de despacho de un período.
// Devuelve:
//   { reused: true, sheet }                 el rango ya tenía orden guardada
//   { empty: true, invoices: 0 }            no hay facturas pagadas en el período
//   { empty: true, invoices, no_units: true } hay facturas pagadas pero sin bultos/cajas
//   { sheet, regenerated: bool }            orden armada y guardada
export async function buildDispatchOrderSheet(base44: any, { from, to, generatedBy = '', force = false }: any) {
  const existing: any = await findSheet(base44, from, to);
  if (existing && !force) return { sheet: existing, reused: true };

  const { fromIso, toIso } = caracasRange(from, to);
  const invoices: any[] = await fetchAllFilter(
    base44.asServiceRole.entities.Invoice,
    { status: 'pagada', payment_date: { $gte: fromIso, $lt: toIso } },
    '-payment_date',
  );

  const invoiceIds: string[] = invoices.map((invoice) => invoice.id);
  if (!invoiceIds.length) return { empty: true, invoices: 0 };

  const receipts: any[] = await filterByIn(
    base44.asServiceRole.entities.CbmIngreso, 'billed_invoice_id', invoiceIds, '-fecha');

  // N° de orden/envío de cada factura y qué factura cubre cada orden.
  const ordersByInvoice = new Map<string, Set<string>>();
  const orderToInvoices = new Map<string, string[]>();
  const allOrderKeys = new Set<string>();
  for (const invoice of invoices) {
    const mine = receipts.filter((receipt) => text(receipt.billed_invoice_id) === invoice.id);
    const numbers = invoiceOrderNumbers(invoice, mine);
    ordersByInvoice.set(invoice.id, new Set([...numbers].map(norm)));
    for (const number of numbers) {
      const key = norm(number);
      allOrderKeys.add(key);
      const list = orderToInvoices.get(key) || [];
      const invoiceNumber = text(invoice.invoice_number);
      if (invoiceNumber && !list.includes(invoiceNumber)) list.push(invoiceNumber);
      orderToInvoices.set(key, list);
    }
  }

  const found = new Map<string, any>();
  const add = (list: any[]) => {
    for (const bulto of list || []) if (bulto?.id) found.set(bulto.id, bulto);
  };
  add(await filterByIn(base44.asServiceRole.entities.Bulto, 'billed_invoice_id', invoiceIds, '-created_date'));
  if (allOrderKeys.size) {
    add(await filterByIn(base44.asServiceRole.entities.Bulto, 'cbm_order_numbers', [...allOrderKeys], '-created_date'));
  }

  // El número de la orden puede venir con distinto formato en el bulto: se comparan
  // también los N° de orden normalizados.
  const allOrdersRaw = new Set<string>();
  for (const invoice of invoices) {
    for (const receipt of receipts.filter((r) => text(r.billed_invoice_id) === invoice.id)) {
      if (text(receipt.invoice_number)) allOrdersRaw.add(text(receipt.invoice_number));
    }
    for (const recibo of Array.isArray(invoice.manual_recibos) ? invoice.manual_recibos : []) {
      if (text(recibo?.invoice_number)) allOrdersRaw.add(text(recibo.invoice_number));
    }
  }

  const bultos = [...found.values()];
  if (!bultos.length) return { empty: true, invoices: invoices.length, no_units: true };

  const emails = unique([
    ...bultos.map((bulto) => bulto.client_email),
    ...invoices.map((invoice) => invoice.client_email),
  ]);
  const clients = await loadClients(base44, emails);

  const cities = new Map<string, any>();
  const globalUnits = new Map<string, any>();
  const clientKeys = new Set<string>();
  const orderKeys = new Set<string>();

  for (const bulto of bultos) {
    const email = text(bulto.client_email);
    const client: any = clients[email] || {};
    const city = text(client.city) || text(bulto.client_snapshot?.city) || NO_CITY;
    const mark = text(bulto.shipping_mark) || text(client.shipping_mark) || NO_MARK;
    const clientName = text(client.full_name)
      || `${text(client.first_name)} ${text(client.last_name)}`.trim()
      || text(bulto.client_snapshot?.full_name)
      || email
      || 'Cliente sin identificar';

    const isCaja = !!bulto.is_caja;
    const code = text(bulto.label_code) || `Bulto ${bulto.bulto_number ?? ''}`.trim() || bulto.id;
    const unit = {
      code,
      kind: isCaja ? 'caja' : 'bulto',
      caja_index: isCaja && bulto.caja_number ? `${bulto.caja_number}/${bulto.caja_total || '?'}` : '',
      package_count: Number(packageCountOfBulto(bulto)) || 0,
      cbm: Number(bulto.cargo_cbm) || 0,
    };

    const ownOrders = unique(Array.isArray(bulto.cbm_order_numbers) ? bulto.cbm_order_numbers : []);
    const fromInvoices = ownOrders.filter((order) => allOrderKeys.has(norm(order)));
    const orderList = fromInvoices.length ? fromInvoices : (ownOrders.length ? ownOrders : [NO_ORDER]);

    let cityGroup = cities.get(city);
    if (!cityGroup) {
      cityGroup = { city, marks: new Map(), units: new Map() };
      cities.set(city, cityGroup);
    }
    let markGroup = cityGroup.marks.get(norm(mark) || mark);
    if (!markGroup) {
      markGroup = {
        shipping_mark: mark,
        client_name: clientName,
        client_email: email,
        state: text(client.state) || text(bulto.client_snapshot?.state) || '',
        orders: new Map(),
        units: new Map(),
      };
      cityGroup.marks.set(norm(mark) || mark, markGroup);
    }
    cityGroup.units.set(code, unit);
    markGroup.units.set(code, unit);
    globalUnits.set(code, unit);
    clientKeys.add(email || clientName);

    for (const order of orderList) {
      const key = norm(order) || order;
      orderKeys.add(key);
      let orderGroup = markGroup.orders.get(key);
      if (!orderGroup) {
        orderGroup = { order_number: order, invoice_numbers: [], units: [] };
        markGroup.orders.set(key, orderGroup);
      }
      orderGroup.units.push(unit);
      for (const invoiceNumber of orderToInvoices.get(key) || []) {
        if (!orderGroup.invoice_numbers.includes(invoiceNumber)) orderGroup.invoice_numbers.push(invoiceNumber);
      }
    }
  }

  const cityList = [...cities.values()]
    .sort((a, b) => (a.city === NO_CITY ? 1 : b.city === NO_CITY ? -1 : a.city.localeCompare(b.city, 'es')))
    .map((cityGroup) => {
      const marks = [...cityGroup.marks.values()]
        .sort((a, b) => String(a.shipping_mark).localeCompare(String(b.shipping_mark), 'es', { numeric: true }))
        .map((markGroup) => {
          const orders = [...markGroup.orders.values()]
            .sort((a, b) => String(a.order_number).localeCompare(String(b.order_number), 'es', { numeric: true }))
            .map((orderGroup) => ({
              order_number: orderGroup.order_number,
              invoice_numbers: orderGroup.invoice_numbers,
              units: orderGroup.units,
              cajas: orderGroup.units.filter((unit: any) => unit.kind === 'caja').length,
              bultos_sueltos: orderGroup.units.filter((unit: any) => unit.kind !== 'caja').length,
              packages: Math.round(orderGroup.units.reduce((sum: number, unit: any) => sum + (Number(unit.package_count) || 0), 0) * 100) / 100,
            }));
          return {
            shipping_mark: markGroup.shipping_mark,
            client_name: markGroup.client_name,
            client_email: markGroup.client_email,
            state: markGroup.state,
            orders,
            ...countUnits(markGroup.units),
          };
        });
      return {
        city: cityGroup.city,
        clients_count: marks.length,
        marks,
        ...countUnits(cityGroup.units),
      };
    });

  const global = countUnits(globalUnits);
  const totals = {
    cities: cityList.length,
    clients: clientKeys.size,
    invoices: invoices.length,
    orders: orderKeys.size,
    cajas: global.cajas,
    bultos_sueltos: global.bultos_sueltos,
    total_unidades: global.total_unidades,
    packages: global.packages,
  };

  const now = new Date().toISOString();
  const sheet: any = {
    period_from: from,
    period_to: to,
    generated_date: text(existing?.generated_date) || now,
    generated_by: text(existing?.generated_by) || generatedBy,
    invoice_ids: invoiceIds,
    invoice_numbers: unique(invoices.map((invoice) => invoice.invoice_number)),
    cities: cityList,
    totals,
  };
  if (existing) {
    sheet.regenerated_date = now;
    sheet.regenerated_by = generatedBy;
    if (text(existing.whatsapp_sent_date)) sheet.whatsapp_sent_date = existing.whatsapp_sent_date;
    if (text(existing.whatsapp_phone)) sheet.whatsapp_phone = existing.whatsapp_phone;
  }
  sheet.message_text = renderDispatchOrderText(sheet);

  const saved = existing
    ? await base44.asServiceRole.entities.DispatchOrderSheet.update(existing.id, sheet)
    : await base44.asServiceRole.entities.DispatchOrderSheet.create(sheet);

  return { sheet: saved, regenerated: !!existing };
}

// Etiqueta compacta de la carga: solo lo que el almacén tiene que sacar.
function unitsLabel(cajas: any, bultos: any) {
  const parts: string[] = [];
  if (Number(cajas) > 0) parts.push(`${Number(cajas)} caja(s)`);
  if (Number(bultos) > 0) parts.push(`${Number(bultos)} bulto(s)`);
  return parts.length ? parts.join(' + ') : '0 bulto(s)';
}

// Mensaje que recibe el almacén: es el mismo texto del TXT y del WhatsApp.
// Va directo al grano: cliente, N° de orden/envío y cuántas cajas y bultos le tocan,
// con el total al final de cada cliente y de cada ciudad. Sin códigos de bulto, ni
// facturas, ni subtotales largos.
export function renderDispatchOrderText(sheet: any) {
  const totals = sheet?.totals || {};
  const lines: string[] = [];

  lines.push('ORDEN DE DESPACHO - TLEC CARGO');
  lines.push(`Período: ${fmtDay(sheet?.period_from)} al ${fmtDay(sheet?.period_to)} · Clientes: ${totals.clients || 0}`);
  const stamp = fmtStamp(sheet?.regenerated_date || sheet?.generated_date);
  lines.push(`Generada: ${stamp}${text(sheet?.regenerated_by || sheet?.generated_by) ? ` · ${text(sheet.regenerated_by || sheet.generated_by)}` : ''}`);
  lines.push('');

  for (const city of sheet?.cities || []) {
    lines.push(`*${String(city.city || '').toUpperCase()}* — ${city.clients_count || 0} cliente(s)`);
    for (const mark of city.marks || []) {
      lines.push(`- ${mark.shipping_mark} · ${mark.client_name}`);
      for (const order of mark.orders || []) {
        const label = (order.units || []).length
          ? unitsLabel(order.cajas, order.bultos_sueltos)
          : 'sin cajas ni bultos registrados';
        lines.push(`   Orden/Envío ${order.order_number} · ${label}`);
      }
      lines.push(`   Total ${mark.shipping_mark}: ${unitsLabel(mark.cajas, mark.bultos_sueltos)}`);
    }
    lines.push(`*Total ${String(city.city || '').toUpperCase()}: ${unitsLabel(city.cajas, city.bultos_sueltos)}*`);
    lines.push('');
  }

  lines.push(`*TOTAL GENERAL:* ${unitsLabel(totals.cajas, totals.bultos_sueltos)}`);
  return lines.join('\n');
}