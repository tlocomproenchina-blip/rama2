// Facturación a los clientes de cada mayorista: una sola factura por lote, con
// el detalle de cada cliente adentro. Cada cliente tiene su tarifa por CBM y su
// tarifa de puerta a puerta por CBM, y se suma 1 USD por cada tracking recibido
// de las órdenes que entran en la factura.
import { caracasDateKey, emailsEnabled, formatCaracasDateTime, truncate } from './wholesalerCore.ts';
import { fetchAllFilter, fetchByClientEmails, normTracking, num } from './paginatedFetch.ts';
import { sendBrevoEmail } from './brevoEmail.ts';

export const HANDLING_FEE = 1;

export const BRAND = {
  name: 'TLEC CARGO',
  tagline: 'Tu carga asegurada desde China hasta Venezuela',
  logo: 'https://media.base44.com/images/public/695da428c9924ef9b68e8866/362c2e6ac_WhatsAppImage2026-08-17at90120AM.jpeg',
  site: 'https://tleccargo.com',
};

export { normTracking };

export function round2(value: any) {
  return Math.round(num(value) * 100) / 100;
}

// El CBM se factura con su precisión real: los recibos traen hasta 4 decimales
// y redondearlo a centésimas cambiaría lo que se le cobra al cliente.
export function round4(value: any) {
  return Math.round(num(value) * 10000) / 10000;
}

export function cbmText(value: any) {
  return round4(value).toFixed(4).replace(/\.?0+$/, '') || '0';
}

// Llaves de comparación: los correos y N° de orden no deben repetirse por
// mayúsculas o espacios, y los trackings se comparan sin distinguir caja.
export function emailKeyOf(value: any) {
  return String(value ?? '').trim().toLowerCase();
}

export function orderKeyOf(value: any) {
  return String(value ?? '').trim().toLowerCase();
}

export function markKeyOf(value: any) {
  return String(value ?? '').trim().toUpperCase();
}

// El mayorista de un cliente es el que quedó marcado en su registro; los que no
// tienen marca cuentan como la conexión principal.
export function stampKeyOf(row: any) {
  return String(row?.wholesaler_key || '').trim() || 'main';
}

export function clientMatchesKey(row: any, key: any) {
  return stampKeyOf(row) === (String(key || '').trim() || 'main');
}

export function defaultWholesalerName(key: any) {
  return String(key || '').trim() === 'main' ? 'Cliente mayorista' : String(key || '');
}

export function trackingKeyOf(value: any) {
  return orderKeyOf(normTracking(value));
}

// Montos de la factura de un cliente: envío y puerta a puerta se cobran por CBM,
// y el manejo por cada tracking recibido.
export function clientAmounts(params: any) {
  const shipping = round2(num(params?.cbm) * num(params?.shippingRate));
  const doorToDoor = round2(num(params?.cbm) * num(params?.doorRate));
  const handling = round2(num(params?.trackings) * num(params?.handlingFee ?? HANDLING_FEE));
  return { shipping, doorToDoor, handling, total: round2(shipping + doorToDoor + handling) };
}

// Órdenes/envíos (CbmIngreso) de esos clientes. Se buscan por correo y también
// por Shipping Mark, porque hay recibos que quedaron solo con la marca.
export async function loadOrdersForClients(base44: any, emails: string[], marks: string[]) {
  const rows: any[] = [];
  if (emails.length) {
    rows.push(...await fetchByClientEmails(base44.asServiceRole.entities.CbmIngreso, emails, '-fecha'));
  }
  const uniqueMarks = [...new Set(marks.filter(Boolean))];
  for (let i = 0; i < uniqueMarks.length; i += 50) {
    const chunk = uniqueMarks.slice(i, i + 50);
    const found = await fetchAllFilter(
      base44.asServiceRole.entities.CbmIngreso,
      { shipping_mark: { $in: chunk } },
      '-fecha',
    );
    rows.push(...found);
  }

  const byEmail: Record<string, any[]> = {};
  const byMark: Record<string, any[]> = {};
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row?.id || seen.has(row.id)) continue;
    seen.add(row.id);
    // Sin N° de orden no hay envío facturable.
    if (!String(row.invoice_number || '').trim()) continue;
    const email = emailKeyOf(row.client_email);
    const mark = markKeyOf(row.shipping_mark);
    if (email) {
      if (!byEmail[email]) byEmail[email] = [];
      byEmail[email].push(row);
    }
    if (mark) {
      if (!byMark[mark]) byMark[mark] = [];
      byMark[mark].push(row);
    }
  }
  return { byEmail, byMark };
}

// Órdenes de un cliente, sin repetir el mismo N° de orden.
export function ordersForClient(orders: any, email: any, mark: any) {
  const list: any[] = [];
  const seen = new Set<string>();
  const add = (rows: any[]) => {
    for (const row of rows || []) {
      const key = orderKeyOf(row.invoice_number);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      list.push(row);
    }
  };
  add(orders?.byEmail?.[emailKeyOf(email)]);
  if (mark) add(orders?.byMark?.[markKeyOf(mark)]);
  return list;
}

// Lo que ya se facturó a esos clientes: sus N° de orden y los trackings cuyo
// manejo ya se cobró. Es lo que evita facturar dos veces lo mismo.
export async function loadBilledIndex(base44: any, emails: string[]) {
  const orders = new Set<string>();
  const trackings = new Set<string>();
  if (!emails.length) return { orders, trackings };
  const rows = await fetchByClientEmails(
    base44.asServiceRole.entities.WholesalerBilledItem,
    emails,
    '-billed_date',
  );
  for (const row of rows || []) {
    const key = orderKeyOf(row.item_key);
    if (!key) continue;
    if (row.item_type === 'tracking') trackings.add(key);
    else orders.add(key);
  }
  return { orders, trackings };
}

// Trackings ya recibidos en el almacén de esas órdenes: es la base del 1 USD por
// paquete. Se cuenta cada tracking una sola vez y se saltan los ya facturados.
export async function receivedTrackingsByOrder(base44: any, orders: any[], billedTrackings?: Set<string>) {
  const orderKeyByTracking = new Map<string, string>();
  const candidates = new Set<string>();

  for (const order of orders || []) {
    const orderKey = orderKeyOf(order?.order_number);
    for (const raw of order?.trackings || []) {
      const tracking = trackingKeyOf(raw);
      if (!tracking || orderKeyByTracking.has(tracking)) continue;
      if (billedTrackings?.has(tracking)) continue;
      orderKeyByTracking.set(tracking, orderKey);
      candidates.add(String(raw).trim());
      candidates.add(normTracking(raw));
    }
  }

  const byOrder: Record<string, { count: number; trackings: string[] }> = {};
  if (!candidates.size) return byOrder;

  const packages = await fetchAllFilter(
    base44.asServiceRole.entities.Package,
    { tracking_number: { $in: Array.from(candidates) }, received_date: { $exists: true } },
    '-received_date',
  );

  const counted = new Set<string>();
  for (const pkg of packages || []) {
    const tracking = trackingKeyOf(pkg.tracking_number);
    const orderKey = orderKeyByTracking.get(tracking);
    if (!orderKey || counted.has(tracking)) continue;
    counted.add(tracking);
    if (!byOrder[orderKey]) byOrder[orderKey] = { count: 0, trackings: [] };
    byOrder[orderKey].count += 1;
    byOrder[orderKey].trackings.push(pkg.tracking_number);
  }
  return byOrder;
}

// Consecutivo del día para la factura: FM-AAAAMMDD-### .
export async function nextInvoiceNumber(base44: any) {
  const day = caracasDateKey();
  const prefix = `FM-${day.replace(/-/g, '')}`;
  let used = 0;
  try {
    const start = new Date(`${day}T00:00:00-04:00`).toISOString();
    const rows = await base44.asServiceRole.entities.WholesalerInvoice.filter(
      { emitted_date: { $gte: start } },
      '-emitted_date',
      200,
    );
    const pattern = new RegExp(`^${prefix}-(\\d+)$`);
    for (const row of rows || []) {
      const match = String(row?.invoice_number || '').match(pattern);
      if (match) used = Math.max(used, num(match[1]));
    }
  } catch (_) {}
  return `${prefix}-${String(used + 1).padStart(3, '0')}`;
}

function money(value: any) {
  return `$${round2(value).toFixed(2)}`;
}

// Factura que recibe cada cliente: su parte del lote, con sus órdenes y sus
// cargos, más el resumen de lo que le correspondió pagar.
export function invoiceEmailHtml(params: any) {
  const client = params?.client || {};
  const orders = client.orders || [];
  const orderRows = orders.map((o: any) => `
              <tr>
                <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#0f172a;">${o.order_number || 'Sin N° de orden'}</td>
                <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#0f172a;">${cbmText(o.cbm)}</td>
                <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#0f172a;">${num(o.received_trackings)}</td>
              </tr>`).join('');

  return `
<div style="background-color:#f7fafd;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;margin:0 auto;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
    <tr>
      <td style="background-color:#f97316;padding:18px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="vertical-align:middle;width:56px;">
              <img src="${BRAND.logo}" alt="${BRAND.name}" width="48" height="48" style="border-radius:10px;display:block;" />
            </td>
            <td style="vertical-align:middle;padding-left:14px;">
              <div style="font-size:18px;font-weight:bold;color:#000000;letter-spacing:0.02em;">${BRAND.name}</div>
              <div style="font-size:12px;color:#000000;">${BRAND.tagline}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:26px 24px 6px;">
        <h1 style="margin:0 0 6px;font-size:22px;line-height:1.25;color:#0f172a;">Factura de servicios logísticos</h1>
        <p style="margin:0;font-size:14px;color:#64748b;">
          Factura ${params.invoiceNumber} · emitida el ${formatCaracasDateTime(params.emittedDate)}
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 24px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7fafd;border:1px solid #e5e7eb;border-radius:12px;">
          <tr>
            <td style="padding:14px 16px;font-size:13px;color:#0f172a;">
              <div style="font-weight:bold;">${client.client_name || client.client_email || ''}</div>
              <div style="color:#64748b;">${client.client_email || ''}</div>
              ${client.shipping_mark ? `<div style="color:#64748b;">Shipping Mark: <b>${client.shipping_mark}</b></div>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 24px 0;">
        <h2 style="margin:0 0 10px;font-size:15px;color:#0f172a;">Órdenes / envíos facturados</h2>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:12px;">
          <tr style="background-color:#f7fafd;">
            <th align="left" style="padding:8px 10px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">N° de orden</th>
            <th align="right" style="padding:8px 10px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">CBM</th>
            <th align="right" style="padding:8px 10px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">Trackings recibidos</th>
          </tr>
          ${orderRows}
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:22px 24px 0;">
        <h2 style="margin:0 0 10px;font-size:15px;color:#0f172a;">Detalle de cargos</h2>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:12px;">
          <tr>
            <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#0f172a;">
              Servicio de envío<br /><span style="color:#64748b;font-size:12px;">${cbmText(client.cbm)} CBM × ${money(client.rate_per_cbm)} por CBM</span>
            </td>
            <td align="right" style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#0f172a;">${money(client.shipping_amount)}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#0f172a;">
              Servicio puerta a puerta<br /><span style="color:#64748b;font-size:12px;">${cbmText(client.cbm)} CBM × ${money(client.door_to_door_per_cbm)} por CBM</span>
            </td>
            <td align="right" style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#0f172a;">${money(client.door_to_door_amount)}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#0f172a;">
              Manejo de paquetes<br /><span style="color:#64748b;font-size:12px;">${num(client.received_trackings)} tracking(s) recibido(s) × ${money(HANDLING_FEE)}</span>
            </td>
            <td align="right" style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#0f172a;">${money(client.handling_amount)}</td>
          </tr>
          <tr style="background-color:#f7fafd;">
            <td style="padding:12px 14px;font-size:15px;font-weight:bold;color:#0f172a;">Total a pagar</td>
            <td align="right" style="padding:12px 14px;font-size:15px;font-weight:bold;color:#0f172a;">${money(client.total)}</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:22px 24px 0;">
        <a href="${BRAND.site}" style="display:inline-block;background-color:#f97316;color:#000000;text-decoration:none;font-size:14px;font-weight:bold;padding:12px 22px;border-radius:12px;">Ver mis envíos en ${BRAND.name}</a>
      </td>
    </tr>
    <tr>
      <td style="padding:24px;font-size:12px;color:#64748b;">
        Esta factura corresponde a tu carga consolidada con ${params.wholesalerName || 'tu proveedor mayorista'} y fue emitida por ${BRAND.name}.
        Si tienes alguna duda, responde a este correo y te ayudamos.
      </td>
    </tr>
  </table>
</div>`;
}

// Envía la factura al correo del cliente y devuelve cómo quedó, para dejarlo
// anotado en la factura y mostrarlo en el panel.
export async function sendInvoiceEmail(base44: any, params: any) {
  const to = String(params?.to || '').trim();
  if (!to) return { status: 'sin_correo', error: 'El cliente no tiene correo registrado.' };
  if (!(await emailsEnabled(base44))) {
    return { status: 'omitido', error: 'El envío de correos está desactivado en la configuración general.' };
  }
  const result = await sendBrevoEmail(base44, {
    to,
    subject: `Factura ${params.invoiceNumber} · ${BRAND.name}`,
    body: params.html,
    from_name: BRAND.name,
    source: 'factura_mayorista',
    campaign_name: params.invoiceNumber,
  });
  if (result.sent) return { status: 'enviado' };
  return { status: 'fallido', error: truncate(result.error || 'No se pudo enviar la factura.', 300) };
}