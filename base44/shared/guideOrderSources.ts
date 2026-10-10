// Fuentes de la emisión manual de guías cuando la carga no tiene bulto registrado.
//
// La unidad de trabajo es la orden / envío: el recibo de carga (CbmIngreso) y su
// N° de orden (CbmIngreso.invoice_number). Desde aquí se resuelve todo lo que
// necesita la guía: el cliente, su CBM y su conteo de paquetes, los bultos
// registrados de esa orden (si existen) y si la orden ya entró en una guía anterior.
//
// Lo usan la emisión por orden/factura (createDispatchGuide con `orders`) y la
// búsqueda de candidatos del panel (getGuideSourceOrders).

import { packageCountOfBulto } from './dispatchGuideAppend.ts';

const text = (value: any) => String(value ?? '').trim();
const num = (value: any) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const lower = (value: any) => text(value).toLowerCase();
const upper = (value: any) => text(value).toUpperCase();
const unique = (list: any[]) => [...new Set((list || []).filter(Boolean))];

const chunk = (list: string[], size = 50) => {
  const out: string[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

export const orderKeyOf = (email: any, order: any) => `${lower(email)}#${text(order)}`;

// «Sin N° de orden» no sirve como referencia: la guía se amarra al N° de orden.
export const isOrderNumber = (raw: any) => {
  const value = text(raw);
  return !!value && upper(value) !== 'SIN N° DE ORDEN';
};

// Una línea sin bulto registrado es la que no tiene código de etiqueta.
export const isUnregisteredLine = (bulto: any) => !!bulto && (!!bulto.unregistered || !text(bulto.label_code));

// Órdenes que ya salieron en una guía como carga sin bulto: se leen las guías que
// llevan esas claves para no volver a ofrecerlas.
async function fetchGuideOrderUsage(base44: any) {
  const used = new Map<string, string>();
  let skip = 0;
  for (let page = 0; page < 3; page += 1) {
    const rows = await base44.asServiceRole.entities.DispatchGuide
      .filter({ unregistered_order_keys: { $exists: true, $ne: [] } }, '-created_date', 200, skip)
      .catch(() => []);
    if (!rows?.length) break;
    (rows || []).forEach((guide: any) => {
      (guide.unregistered_order_keys || []).forEach((key: any) => {
        const clean = lower(key);
        if (clean && !used.has(clean)) used.set(clean, text(guide.guide_number));
      });
    });
    if (rows.length < 200) break;
    skip += 200;
  }
  return used;
}

// Bultos que ya están dentro de una guía (su escaneo quedó marcado con la guía).
async function fetchBultosInGuide(base44: any, codes: string[]) {
  const inGuide = new Set<string>();
  for (const part of chunk(unique((codes || []).map(upper)))) {
    const rows = await base44.asServiceRole.entities.DispatchScanLog
      .filter(
        {
          $and: [
            { $or: [{ bulto_label_code: { $in: part } }, { scanned_code: { $in: part } }] },
            { guide_id: { $ne: null } },
          ],
        },
        '-created_date',
        500
      )
      .catch(() => []);
    (rows || []).forEach((row: any) => {
      const code = upper(row?.bulto_label_code || row?.scanned_code);
      if (code) inGuide.add(code);
    });
  }
  return inGuide;
}

async function fetchUserProfiles(base44: any, emails: string[]) {
  const map = new Map<string, any>();
  for (const part of chunk(unique(emails.map(lower)))) {
    const rows = await base44.asServiceRole.entities.User
      .filter({ email: { $in: part } }, undefined, part.length + 10)
      .catch(() => []);
    (rows || []).forEach((user: any) => {
      const email = lower(user?.email);
      if (email && !map.has(email)) map.set(email, user);
    });
  }
  return map;
}

// Bultos registrados por orden: un bulto puede cubrir varias órdenes.
async function fetchBultosByOrder(base44: any, orderNumbers: string[]) {
  const map = new Map<string, any[]>();
  for (const part of chunk(unique(orderNumbers))) {
    const rows = await base44.asServiceRole.entities.Bulto
      .filter({ cbm_order_numbers: { $in: part } }, '-created_date', 500)
      .catch(() => []);
    (rows || []).forEach((bulto: any) => {
      (bulto?.cbm_order_numbers || []).forEach((raw: any) => {
        const order = text(raw);
        if (!isOrderNumber(order)) return;
        const key = orderKeyOf(bulto?.client_email, order);
        if (!map.has(key)) map.set(key, []);
        (map.get(key) as any[]).push(bulto);
      });
    });
  }
  return map;
}

// Órdenes de una factura: los recibos con los que se armó (Facturación Manual) y
// los envíos de su orden de almacén.
export const orderNumbersOfInvoice = (invoice: any) => {
  const out = new Set<string>();
  (invoice?.manual_recibos || []).forEach((recibo: any) => {
    const value = text(recibo?.invoice_number);
    if (isOrderNumber(value)) out.add(value);
  });
  (invoice?.warehouse_order?.groups || []).forEach((group: any) => {
    const value = text(group?.order_number);
    if (isOrderNumber(value)) out.add(value);
  });
  return [...out];
};

async function fetchInvoiceLinks(base44: any, receipts: any[], emails: string[]) {
  const byOrderKey = new Map<string, any>();
  const byId = new Map<string, any>();

  for (const part of chunk(unique(emails))) {
    const rows = await base44.asServiceRole.entities.Invoice
      .filter({ client_email: { $in: part }, status: 'pagada' }, '-payment_date', 500)
      .catch(() => []);
    (rows || []).forEach((invoice: any) => {
      byId.set(text(invoice?.id), invoice);
      orderNumbersOfInvoice(invoice).forEach((order: string) => {
        const key = orderKeyOf(invoice?.client_email, order);
        if (!byOrderKey.has(key)) byOrderKey.set(key, invoice);
      });
    });
  }

  // Facturas que el recibo trae amarradas (aunque todavía no estén pagadas): sirven
  // para mostrar la referencia, no para validar el pago.
  const linkedIds = unique(receipts.map((row: any) => text(row?.billed_invoice_id))).filter((id: string) => !byId.has(id));
  for (const part of chunk(linkedIds)) {
    const rows = await base44.asServiceRole.entities.Invoice
      .filter({ id: { $in: part } }, '-invoice_date', 100)
      .catch(() => []);
    (rows || []).forEach((invoice: any) => {
      byId.set(text(invoice?.id), invoice);
      orderNumbersOfInvoice(invoice).forEach((order: string) => {
        const key = orderKeyOf(invoice?.client_email, order);
        if (!byOrderKey.has(key)) byOrderKey.set(key, invoice);
      });
    });
  }

  return { byOrderKey, byId };
}

// Recibos de las órdenes pedidas (una consulta por cliente).
export async function fetchReceiptsForOrders(base44: any, requests: any[]) {
  const byEmail = new Map<string, Set<string>>();
  (requests || []).forEach((request: any) => {
    const email = lower(request?.client_email);
    const order = text(request?.order_number);
    if (!email || !isOrderNumber(order)) return;
    if (!byEmail.has(email)) byEmail.set(email, new Set());
    (byEmail.get(email) as Set<string>).add(order);
  });

  const receipts: any[] = [];
  for (const [email, orders] of byEmail) {
    const rows = await base44.asServiceRole.entities.CbmIngreso
      .filter({ client_email: email, invoice_number: { $in: [...orders] } }, '-fecha', 300)
      .catch(() => []);
    (rows || []).forEach((row: any) => receipts.push(row));
  }
  return receipts;
}

// Cada recibo se vuelve un candidato: qué cliente es, qué carga trae, qué bultos
// registrados tiene esa orden y si ya salió en una guía.
export async function resolveOrderCandidates(base44: any, receipts: any[]) {
  const list = (Array.isArray(receipts) ? receipts : []).filter((row: any) => isOrderNumber(row?.invoice_number));
  if (!list.length) return [];

  const emails = unique(list.map((row: any) => text(row?.client_email)));
  const orderNumbers = unique(list.map((row: any) => text(row?.invoice_number)));

  const [profiles, bultosByOrder, invoices, guideUsage] = await Promise.all([
    fetchUserProfiles(base44, emails),
    fetchBultosByOrder(base44, orderNumbers),
    fetchInvoiceLinks(base44, list, emails),
    fetchGuideOrderUsage(base44),
  ]);

  const allBultoCodes = unique([...bultosByOrder.values()].flat().map((bulto: any) => bulto?.label_code));
  const bultosInGuide = await fetchBultosInGuide(base44, allBultoCodes);

  return list.map((receipt: any) => {
    const clientEmail = text(receipt?.client_email);
    const orderNumber = text(receipt?.invoice_number);
    const key = orderKeyOf(clientEmail, orderNumber);
    const profile: any = profiles.get(lower(clientEmail)) || null;

    const orderBultos = (bultosByOrder.get(key) || []).filter((bulto: any) => {
      const owner = lower(bulto?.client_email);
      return !owner || !clientEmail || owner === lower(clientEmail);
    });

    const bultos = orderBultos
      .filter((bulto: any) => !bultosInGuide.has(upper(bulto?.label_code)))
      .map((bulto: any) => ({
        label_code: upper(bulto?.label_code),
        package_count: packageCountOfBulto(bulto),
        cbm: num(bulto?.cargo_cbm),
        is_caja: !!bulto?.is_caja,
        caja_number: num(bulto?.caja_number),
        caja_total: num(bulto?.caja_total),
      }))
      .filter((bulto: any) => !!bulto.label_code);

    const trackings = unique((receipt?.tracking_numbers || []).map(text));
    const registered = bultos.length > 0;
    const packages = registered
      ? bultos.reduce((sum: number, bulto: any) => sum + num(bulto.package_count), 0)
      : num(receipt?.package_count) || trackings.length;
    const cbm = registered
      ? Number(bultos.reduce((sum: number, bulto: any) => sum + num(bulto.cbm), 0).toFixed(4))
      : num(receipt?.cbm);

    const invoice: any =
      invoices.byOrderKey.get(key) || (receipt?.billed_invoice_id ? invoices.byId.get(text(receipt.billed_invoice_id)) : null) || null;
    const usedGuide = guideUsage.get(key) || '';
    const shippingMark = text(receipt?.shipping_mark) || text(profile?.shipping_mark);
    const clientName = text(profile?.full_name) || text(receipt?.client_name) || shippingMark || clientEmail;

    return {
      key,
      order_number: orderNumber,
      client_email: clientEmail,
      client_name: clientName,
      shipping_mark: shippingMark,
      invoice_number: text(invoice?.invoice_number),
      invoice_id: text(invoice?.id),
      invoice_paid: text(invoice?.status) === 'pagada',
      cbm,
      package_count: packages,
      trackings,
      fecha: text(receipt?.fecha),
      billing_marked: !!receipt?.billing_marked,
      disponible_entrega: !!receipt?.disponible_entrega,
      bultos,
      bultos_total: bultos.length,
      packages_total: packages,
      cbm_total: cbm,
      unregistered: !registered,
      // Una orden ya emitida sin bulto no se vuelve a ofrecer; si luego aparece su
      // bulto registrado sí se puede emitir, porque esa carga todavía no salió.
      already_in_guide: !registered && !!usedGuide,
      guide_number: usedGuide,
      client: {
        full_name: clientName,
        email: clientEmail,
        cedula: text(profile?.cedula),
        whatsapp: text(profile?.whatsapp),
        address: text(profile?.address),
        city: text(profile?.city),
        state: text(profile?.state),
        shipping_mark: shippingMark,
      },
    };
  });
}

const sortLines = (a: any, b: any) => {
  const aCode = text(a?.label_code);
  const bCode = text(b?.label_code);
  if (!aCode && !bCode) return text(a?.order_number).localeCompare(text(b?.order_number));
  if (!aCode) return 1;
  if (!bCode) return -1;
  return aCode.localeCompare(bCode);
};

export const totalsOfLines = (bultos: any[]) => {
  const rows = Array.isArray(bultos) ? bultos : [];
  return {
    bultos: rows.length,
    packages: rows.reduce((sum: number, bulto: any) => sum + num(bulto?.package_count), 0),
    unregistered: rows.filter(isUnregisteredLine).length,
    scanned: 0,
    cajas: rows.filter((bulto: any) => bulto?.is_caja).length,
    cbm: Number(rows.reduce((sum: number, bulto: any) => sum + num(bulto?.cbm), 0).toFixed(4)),
  };
};

// Convierte las órdenes elegidas en grupos de cliente listos para la guía: una
// línea por orden, con sus bultos registrados o como carga sin bulto registrado.
export function buildGuideGroupsFromOrders(candidates: any[], emittedAt: string) {
  const groups = new Map<string, any>();
  const orderKeys: string[] = [];

  (candidates || []).forEach((candidate: any) => {
    const email = text(candidate?.client_email);
    const groupKey = lower(email) || `order:${text(candidate?.key)}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        client_key: groupKey,
        client_email: email,
        client_name: text(candidate?.client_name),
        shipping_mark: text(candidate?.shipping_mark),
        orders_count: 0,
        client: candidate?.client || {},
        bultos: [],
      });
    }
    const group: any = groups.get(groupKey);

    const bultos = Array.isArray(candidate?.bultos) ? candidate.bultos : [];
    bultos.forEach((bulto: any) => {
      group.bultos.push({
        label_code: text(bulto?.label_code),
        package_count: num(bulto?.package_count),
        registered: true,
        unregistered: false,
        date: text(candidate?.fecha) || emittedAt,
        order_number: text(candidate?.order_number),
        invoice_number: text(candidate?.invoice_number),
        tracking_numbers: [],
        scans: 0,
        is_caja: !!bulto?.is_caja,
        caja_number: num(bulto?.caja_number),
        caja_total: num(bulto?.caja_total),
        cbm: num(bulto?.cbm),
      });
    });

    if (!bultos.length) {
      orderKeys.push(text(candidate?.key));
      group.bultos.push({
        label_code: '',
        package_count: num(candidate?.package_count),
        registered: false,
        unregistered: true,
        date: text(candidate?.fecha) || emittedAt,
        order_number: text(candidate?.order_number),
        invoice_number: text(candidate?.invoice_number),
        tracking_numbers: unique((candidate?.trackings || []).map(text)),
        scans: 0,
        is_caja: false,
        caja_number: 0,
        caja_total: 0,
        cbm: num(candidate?.cbm),
      });
    }

    group.orders_count += 1;
    if (!group.shipping_mark && candidate?.shipping_mark) group.shipping_mark = text(candidate.shipping_mark);
  });

  const clients = [...groups.values()]
    .map((group: any) => {
      const bultos = [...group.bultos].sort(sortLines);
      return { ...group, bultos, totals: totalsOfLines(bultos) };
    })
    .sort((a: any, b: any) => b.totals.bultos - a.totals.bultos || text(a.client_name).localeCompare(text(b.client_name)));

  return { clients, orderKeys };
}