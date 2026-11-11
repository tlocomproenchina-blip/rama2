// Guía de despacho de una factura pagada: reúne todos los bultos vinculados a la
// factura (los mismos que su orden de almacén) y emite siempre una guía NUEVA con
// el siguiente correlativo, sin sumarlos a una guía abierta previa.
//
//  - mode 'auto': la dispara el cambio de la factura a pagada. Es idempotente: si
//    la factura ya tiene su guía automática, no se crea otra.
//  - mode 'manual': botón "Generar guía de despacho". Cada pulsación crea una guía
//    nueva; request_key evita duplicarla si la misma pulsación se reintenta.

import {
  allocateGuideSequence,
  markScansWithGuide,
  nextGuideNumber,
  normCode,
  packageCountOfBulto,
  recomputeGuideTotals,
  unique,
} from './dispatchGuideAppend.ts';
import { findInvoiceBultos } from './warehouseOrder.ts';
import { nextSaturdayDateKey } from './guideDispatchDue.ts';

const text = (value: any) => String(value ?? '').trim();
const norm = (value: any) => text(value).toUpperCase().replace(/^0+(?=\d)/, '');

async function findExisting(base44: any, query: any) {
  const rows = await base44.asServiceRole.entities.DispatchGuide
    .filter(query, '-created_date', 1)
    .catch(() => []);
  return rows?.[0] || null;
}

export async function createInvoiceDispatchGuide(base44: any, { invoiceId, mode, requestKey, user }: any) {
  const invoice: any = await base44.asServiceRole.entities.Invoice.get(invoiceId).catch(() => null);
  if (!invoice) return { status: 404, error: 'Factura no encontrada' };
  if (mode === 'auto' && invoice.status !== 'pagada') return { skipped: 'not_paid' };

  // Una factura tiene una sola guía: si ya existe, se devuelve esa.
  const existing = await findExisting(base44, { invoice_id: invoiceId });
  if (existing) return { guide: existing, existing: true };

  const { bultos, orderKeys } = await findInvoiceBultos(base44, invoice);
  if (!bultos.length && !invoice.warehouse_order?.groups?.length) {
    return { empty: true, invoice_number: invoice.invoice_number || '' };
  }

  const users = await base44.asServiceRole.entities.User
    .filter({ email: invoice.client_email }, '-updated_date', 1)
    .catch(() => []);
  const profile: any = users?.[0] || {};
  const snapshot: any = bultos.find((b: any) => b?.client_snapshot)?.client_snapshot || {};
  const mark = text(profile.shipping_mark) || text(snapshot.shipping_mark) || text(bultos[0]?.shipping_mark);
  const fullName = text(profile.full_name)
    || `${text(profile.first_name)} ${text(profile.last_name)}`.trim()
    || text(snapshot.full_name);

  const emittedDate = new Date().toISOString();

  // La orden de almacén guardada es la fuente: sus bultos no cambian aunque luego se
  // fusionen o editen. Si no hay orden guardada, se usan los bultos actuales.
  const liveByCode = new Map(bultos.map((b: any) => [normCode(b.label_code), b]));
  const snapshotRows = snapshotGuideRows(invoice, liveByCode, emittedDate);
  const missing = snapshotRows ? snapshotRows.filter((r: any) => !liveByCode.has(r.label_code)) : [];
  const warning = missing.length
    ? `${missing.length} bulto(s) de la orden de almacén ya no existen por separado (se fusionaron en ${[...liveByCode.keys()].join(', ') || 'otro bulto'}). La guía usa los bultos de la orden.`
    : '';

  const rows = snapshotRows || bultos
    .map((bulto: any) => {
      const own = (Array.isArray(bulto.cbm_order_numbers) ? bulto.cbm_order_numbers : []).map(text).filter(Boolean);
      const fromInvoice = own.filter((o: string) => orderKeys.has(norm(o)));
      return {
        label_code: normCode(bulto.label_code),
        package_count: packageCountOfBulto(bulto) || (bulto.is_caja ? 0 : 1),
        registered: true,
        date: emittedDate,
        order_number: (fromInvoice.length ? fromInvoice : own).join(', '),
        invoice_number: text(invoice.invoice_number),
        scans: 0,
        is_caja: !!bulto.is_caja,
        caja_number: Number(bulto.caja_number) || 0,
        caja_total: Number(bulto.caja_total) || 0,
        cbm: Number(bulto.cargo_cbm) || 0,
      };
    })
    .filter((row: any) => row.label_code)
    .sort((a: any, b: any) => a.label_code.localeCompare(b.label_code));

  const client = {
    client_key: text(invoice.client_email).toLowerCase() || `unknown:${mark || 'sin-mark'}`,
    client_email: text(invoice.client_email),
    client_name: fullName || text(invoice.client_email),
    shipping_mark: mark,
    orders_count: new Set(rows.map((r: any) => r.order_number).filter(Boolean)).size,
    client: {
      full_name: fullName,
      email: text(invoice.client_email),
      cedula: text(profile.cedula) || text(snapshot.cedula),
      whatsapp: text(profile.whatsapp) || text(snapshot.whatsapp),
      address: text(profile.address) || text(snapshot.address),
      city: text(profile.city) || text(snapshot.city),
      state: text(profile.state) || text(snapshot.state),
      shipping_mark: mark,
    },
    bultos: rows,
    totals: {},
  };
  const clients = [client];
  const rowTotals = recomputeGuideTotals(clients);
  // Los bultos no traen CBM propio: se usa el CBM facturado de la factura vinculada.
  const invoiceCbm = Number(invoice.billed_cbm) || Number(invoice.total_cbm) || 0;
  const totals = { ...rowTotals, cbm: rowTotals.cbm > 0 ? rowTotals.cbm : Number(invoiceCbm.toFixed(4)) };
  client.totals = {
    bultos: rows.length,
    packages: totals.packages,
    unregistered: 0,
    scanned: 0,
    cajas: totals.cajas,
    cbm: totals.cbm,
  };

  const sequence = await allocateGuideSequence(base44);
  if (sequence === null) return { status: 500, error: 'No se pudo asignar el número de guía, intenta de nuevo' };
  const guideNumber = nextGuideNumber(sequence);
  const bultoCodes = unique(rows.map((r: any) => r.label_code));

  const guide = await base44.asServiceRole.entities.DispatchGuide.create({
    guide_number: guideNumber,
    guide_sequence: sequence,
    emitted_date: emittedDate,
    dispatch_due_date: nextSaturdayDateKey(emittedDate),
    emitted_by: text(user?.email),
    emitted_by_name: text(user?.full_name),
    auto_generated: mode === 'auto',
    source: 'factura_pagada',
    invoice_id: invoiceId,
    invoice_number: text(invoice.invoice_number),
    ...(mode !== 'auto' && requestKey ? { request_key: requestKey } : {}),
    last_updated_date: emittedDate,
    last_updated_by: text(user?.email),
    clients,
    client_names: unique([client.client_name]),
    client_emails: unique([client.client_email]),
    shipping_marks: unique([normCode(mark)]),
    bulto_codes: bultoCodes,
    unregistered_order_keys: [],
    totals: { ...totals, clients: 1, bultos: rows.length, unregistered: 0 },
    dispatch_status: 'emitida',
  });

  // Si otra solicitud simultánea creó una guía antes, se conserva la primera.
  const all = await base44.asServiceRole.entities.DispatchGuide
    .filter({ invoice_id: invoiceId }, 'created_date', 5)
    .catch(() => []);
  const first = all?.[0];
  if (first && first.id !== guide.id) {
    await base44.asServiceRole.entities.DispatchGuide.delete(guide.id).catch(() => null);
    return { guide: first, existing: true };
  }

  await markScansWithGuide(base44, { codes: bultoCodes, guideId: guide.id, guideNumber, emittedDate }).catch(() => false);

  return { guide, bultos: rows.length, warning };
}

// Líneas de la guía desde la orden de almacén guardada: cada bulto una sola vez
// (aunque aparezca en varios N° de contenedor), con sus contenedores unidos.
function snapshotGuideRows(invoice: any, liveByCode: Map<string, any>, emittedDate: string) {
  const groups = invoice?.warehouse_order?.groups;
  if (!Array.isArray(groups) || !groups.length) return null;
  const byCode = new Map<string, any>();
  for (const group of groups) {
    for (const b of Array.isArray(group?.bultos) ? group.bultos : []) {
      const code = normCode(b?.label_code);
      if (!code) continue;
      let row = byCode.get(code);
      if (!row) {
        const live = liveByCode.get(code);
        row = {
          label_code: code,
          package_count: Number(b.package_count) || (b.is_caja ? 0 : 1),
          registered: true,
          date: emittedDate,
          orders: new Set<string>(),
          invoice_number: text(invoice.invoice_number),
          scans: 0,
          is_caja: !!b.is_caja,
          caja_number: Number(b.caja_number) || 0,
          caja_total: Number(b.caja_total) || 0,
          cbm: Number(live?.cargo_cbm) || 0,
        };
        byCode.set(code, row);
      }
      const order = text(group.order_number);
      if (order && !/^sin n/i.test(order)) row.orders.add(order);
    }
  }
  const rows = [...byCode.values()].map(({ orders, ...row }) => ({ ...row, order_number: [...orders].join(', ') }));
  return rows.length ? rows.sort((a, b) => a.label_code.localeCompare(b.label_code)) : null;
}