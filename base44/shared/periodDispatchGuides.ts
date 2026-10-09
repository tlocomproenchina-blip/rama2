// Guías de despacho de un período de facturas pagadas.
//
// Una guía individual por cliente, armada con la MISMA orden de despacho del período
// (shared/dispatchOrderSheet.ts): se toman los clientes con facturas pagadas dentro
// del rango (fecha de pago, hora de Caracas), sus N° de orden/envío y las cajas y
// bultos que el almacén debe sacar, y cada cliente recibe su guía con su propio
// número correlativo, guardada en el historial (DispatchGuide) para reimprimirla.
//
// El período se identifica con period_key ("desde_hasta"). Si el período ya tenía
// guías guardadas, esos clientes no se vuelven a generar: la operación se puede
// repetir sin duplicar guías.
//
// La usa la función generatePeriodDispatchGuides (pantalla Guías de Despacho).

import { buildDispatchOrderSheet } from './dispatchOrderSheet.ts';
import {
  allocateGuideSequence,
  markScansWithGuide,
  nextGuideNumber,
  recomputeGuideTotals,
  unique,
} from './dispatchGuideAppend.ts';
import { fetchAllFilter } from './paginatedFetch.ts';

const text = (value: any) => String(value ?? '').trim();
const NO_ORDER = 'Sin N° de orden';
const NO_CITY = 'Sin ciudad';

export const periodKey = (from: string, to: string) => `${from}_${to}`;

// Perfiles de los clientes: se piden por la vía que ya usa el resto del sistema para
// traer cédula, teléfono y dirección aunque haya muchos usuarios.
async function loadProfiles(base44: any, emails: string[]) {
  const byEmail: Record<string, any> = {};
  if (!emails.length) return byEmail;
  try {
    const res: any = await base44.asServiceRole.functions.invoke('getClientsByEmails', { emails });
    const clients = res?.clients || res?.data?.clients || {};
    for (const [key, value] of Object.entries(clients)) {
      const email = text(key).toLowerCase();
      if (email) byEmail[email] = value;
    }
  } catch (_) {}
  return byEmail;
}

// Un solo grupo por cliente dentro de la orden de despacho: todas sus órdenes/envíos
// y todas sus cajas y bultos, sin repetir un bulto que aparezca en más de una orden.
function groupClients(sheet: any) {
  const groups = new Map<string, any>();

  for (const city of sheet?.cities || []) {
    for (const mark of city?.marks || []) {
      const email = text(mark.client_email);
      const key = (email || `mark:${text(mark.shipping_mark).toUpperCase()}`).toLowerCase();
      let group = groups.get(key);
      if (!group) {
        group = {
          key,
          email,
          client_name: text(mark.client_name),
          shipping_mark: text(mark.shipping_mark),
          city: text(city.city),
          state: text(mark.state),
          order_numbers: [] as string[],
          codes: new Set<string>(),
          bultos: [] as any[],
        };
        groups.set(key, group);
      }

      if (!group.client_name) group.client_name = text(mark.client_name);
      if (!group.shipping_mark) group.shipping_mark = text(mark.shipping_mark);
      if (!group.state) group.state = text(mark.state);
      if (!group.city || group.city === NO_CITY) group.city = text(city.city) || group.city;

      for (const order of mark.orders || []) {
        const orderNumber = text(order.order_number) || NO_ORDER;
        if (!group.order_numbers.includes(orderNumber)) group.order_numbers.push(orderNumber);

        for (const unit of order.units || []) {
          const code = text(unit.code);
          if (!code || group.codes.has(code)) continue;
          group.codes.add(code);
          const [cajaNumber, cajaTotal] = String(unit.caja_index || '').split('/');
          group.bultos.push({
            label_code: code,
            package_count: Number(unit.package_count) || 0,
            registered: true,
            date: '',
            order_number: orderNumber,
            scans: 1,
            is_caja: unit.kind === 'caja',
            caja_number: Number(cajaNumber) || 0,
            caja_total: Number(cajaTotal) || 0,
            cbm: Number(unit.cbm) || 0,
          });
        }
      }
    }
  }

  return [...groups.values()];
}

// Bloque de cliente de la guía, con el mismo formato que guardan las guías que nacen
// del escáner de despacho y del lote de etiquetas.
function buildClientGroup(group: any, profile: any) {
  const client = {
    full_name: text(profile?.full_name) || group.client_name,
    email: group.email,
    cedula: text(profile?.cedula),
    whatsapp: text(profile?.whatsapp) || text(profile?.phone),
    address: text(profile?.address),
    city: text(profile?.city) || group.city,
    state: text(profile?.state) || group.state,
    shipping_mark: text(profile?.shipping_mark) || group.shipping_mark,
  };

  const bultos = [...group.bultos].sort((a, b) => String(a.label_code).localeCompare(String(b.label_code)));
  const clientGroup = {
    client_key: group.key,
    client_email: group.email,
    client_name: client.full_name || group.email || `Cliente — ${group.shipping_mark || 'sin mark'}`,
    shipping_mark: client.shipping_mark,
    orders_count: group.order_numbers.length,
    client,
    bultos,
    totals: {
      bultos: bultos.length,
      packages: bultos.reduce((sum: number, b: any) => sum + (Number(b.package_count) || 0), 0),
      unregistered: 0,
      scanned: bultos.length,
      cajas: bultos.filter((b: any) => b.is_caja).length,
      cbm: Number(bultos.reduce((sum: number, b: any) => sum + (Number(b.cbm) || 0), 0).toFixed(4)),
    },
  };

  return clientGroup;
}

// Clientes que ya tienen guía guardada en este período: no se generan otra vez.
function coveredKeys(guides: any[]) {
  const keys = new Set<string>();
  for (const guide of guides || []) {
    for (const client of guide?.clients || []) {
      if (text(client?.client_key)) keys.add(text(client.client_key).toLowerCase());
      if (text(client?.client_email)) keys.add(text(client.client_email).toLowerCase());
      if (text(client?.shipping_mark)) keys.add(`mark:${text(client.shipping_mark).toUpperCase()}`);
    }
    for (const email of guide?.client_emails || []) {
      if (text(email)) keys.add(text(email).toLowerCase());
    }
    for (const mark of guide?.shipping_marks || []) {
      if (text(mark)) keys.add(`mark:${text(mark).toUpperCase()}`);
    }
  }
  return keys;
}

// Arma (y guarda) las guías del período: una por cliente, numeradas con el correlativo
// de guías, listas para el PDF conjunto.
export async function buildPeriodDispatchGuides(base44: any, { from, to, generatedBy = '' }: any) {
  const sheetResult: any = await buildDispatchOrderSheet(base44, { from, to, generatedBy });

  if (sheetResult.empty) {
    return {
      empty: true,
      invoices: Number(sheetResult.invoices) || 0,
      no_units: !!sheetResult.no_units,
      guides: [],
      totals: null,
      created: 0,
      existing: 0,
      failed: [],
    };
  }

  const key = periodKey(from, to);
  const groups = groupClients(sheetResult.sheet);

  const existingGuides: any[] =
    (await fetchAllFilter(
      base44.asServiceRole.entities.DispatchGuide,
      { period_key: key },
      'guide_sequence'
    ).catch(() => [])) || [];

  const covered = coveredKeys(existingGuides);
  const pending = groups.filter(
    (group) =>
      !covered.has(group.key) &&
      !(group.email && covered.has(group.email.toLowerCase())) &&
      !(group.shipping_mark && covered.has(`mark:${group.shipping_mark.toUpperCase()}`))
  );

  const profiles = await loadProfiles(base44, unique(groups.map((group) => group.email)));
  const createdGuides: any[] = [];
  const failed: string[] = [];

  for (const group of pending) {
    const clientGroup = buildClientGroup(group, profiles[text(group.email).toLowerCase()]);
    const codes = unique(clientGroup.bultos.map((b: any) => b.label_code));
    if (!codes.length) continue;

    const sequence = await allocateGuideSequence(base44);
    if (sequence === null) {
      failed.push(clientGroup.client_name);
      continue;
    }

    const guideNumber = nextGuideNumber(sequence);
    const emittedDate = new Date().toISOString();

    const guide = await base44.asServiceRole.entities.DispatchGuide.create({
      guide_number: guideNumber,
      guide_sequence: sequence,
      emitted_date: emittedDate,
      emitted_by: generatedBy,
      emitted_by_name: '',
      auto_generated: false,
      source: 'periodo_pagos',
      period_key: key,
      last_updated_date: emittedDate,
      last_updated_by: generatedBy,
      filter_from: from,
      filter_to: to,
      clients: [clientGroup],
      client_names: unique([clientGroup.client_name]),
      client_emails: unique([clientGroup.client_email]),
      shipping_marks: unique([clientGroup.shipping_mark]),
      bulto_codes: codes,
      totals: recomputeGuideTotals([clientGroup]),
      dispatch_status: 'emitida',
    });

    // Los escaneos de esos bultos quedan marcados con la guía: dejan de ofrecerse como
    // pendientes en el lote de etiquetas y no entran en una guía paralela.
    await markScansWithGuide(base44, {
      codes,
      guideId: guide.id,
      guideNumber,
      emittedDate,
    });

    createdGuides.push(guide);
  }

  const guides = [...existingGuides, ...createdGuides].sort(
    (a: any, b: any) => (Number(a.guide_sequence) || 0) - (Number(b.guide_sequence) || 0)
  );

  const totals = guides.reduce(
    (acc: any, guide: any) => ({
      guides: acc.guides + 1,
      clients: acc.clients + (Number(guide.totals?.clients) || 0),
      bultos: acc.bultos + (Number(guide.totals?.bultos) || 0),
      packages: acc.packages + (Number(guide.totals?.packages) || 0),
      cajas: acc.cajas + (Number(guide.totals?.cajas) || 0),
      cbm: Number((acc.cbm + (Number(guide.totals?.cbm) || 0)).toFixed(4)),
    }),
    { guides: 0, clients: 0, bultos: 0, packages: 0, cajas: 0, cbm: 0 }
  );

  return {
    empty: false,
    period_key: key,
    guides,
    totals,
    created: createdGuides.length,
    existing: existingGuides.length,
    pending_clients: pending.length,
    failed,
  };
}