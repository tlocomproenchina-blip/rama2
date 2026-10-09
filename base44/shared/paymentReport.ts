// Informe TXT de los pagos aprobados desde Validación de Pagos.
// Módulo plano compartido por las funciones de aprobación (individual y en bloque)
// y por la descarga del informe del día: el formato del TXT se arma en un solo
// lugar, así el archivo de una aprobación y el del día salen iguales.
// Solo exporta utilidades (sin Deno.serve).

const CARACAS_TZ = 'America/Caracas';

export interface ApprovalReportInput {
  payment_type: 'abono' | 'factura' | 'consolidacion';
  source_id: string;
  client_email?: string;
  invoice_id?: string;
  invoice_number?: string;
  amount?: number;
  approved_by?: string;
  shipping_mark?: string;
}

// Día local de Caracas (YYYY-MM-DD): delimita el informe diario.
export function caracasDay(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CARACAS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

// Fecha y hora de Caracas para imprimir en el informe.
export function caracasStamp(value: any): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('es-VE', {
    timeZone: CARACAS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`;
}

// 2026-10-08 -> 08/10/2026
export function formatDay(day: string): string {
  const match = String(day || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(day || '');
}

function safeFileName(text: string): string {
  return String(text || '').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
}

export function dailyReportFileName(day: string): string {
  return `pagos_aprobados_${safeFileName(day) || 'dia'}.txt`;
}

export function batchReportFileName(day: string): string {
  return `pagos_aprobados_lote_${safeFileName(day) || 'dia'}.txt`;
}

export function approvalReportFileName(entry: any): string {
  return `pago_aprobado_${safeFileName(entry?.invoice_number || entry?.source_id || 'pago')}.txt`;
}

const round4 = (value: any): number => Math.round(Number(value || 0) * 10000) / 10000;

// CBM con hasta 4 decimales, sin ceros de relleno (0.028, 1.5).
const formatCbm = (value: any): string => String(round4(value));

const cleanValue = (value: any): string => {
  const text = String(value ?? '').trim();
  return /^(n\/a|-)$/i.test(text) ? '' : text;
};

// CBM de cada orden/envío (CbmIngreso.invoice_number) de la factura confirmada:
// los recibos incluidos en la factura, los CbmIngreso facturados en ella y, cuando
// la factura se armó desde 'Carga en almacén', los N° de orden de sus bultos.
export async function resolveOrderCbm(base44: any, invoice: any): Promise<Array<{ order_number: string; cbm: number }>> {
  const rows = new Map<string, number>();

  const manualRecibos = Array.isArray(invoice?.manual_recibos) ? invoice.manual_recibos : [];
  manualRecibos.forEach((recibo: any) => {
    const order = cleanValue(recibo?.invoice_number);
    if (order) rows.set(order, round4(recibo?.cbm));
  });

  if (invoice?.id) {
    const recibos = await base44.asServiceRole.entities.CbmIngreso
      .filter({ billed_invoice_id: invoice.id }, '-fecha', 200)
      .catch(() => []);
    (recibos || []).forEach((recibo: any) => {
      const order = cleanValue(recibo.invoice_number);
      if (order && !rows.has(order)) rows.set(order, round4(recibo.cbm));
    });

    // Bultos facturados sin recibo propio: su CBM oficial se reparte entre sus
    // N° de orden, solo para los que aún no tienen CBM registrado.
    const bultos = await base44.asServiceRole.entities.Bulto
      .filter({ billed_invoice_id: invoice.id }, '-created_date', 200)
      .catch(() => []);
    (bultos || []).forEach((bulto: any) => {
      const orders = (Array.isArray(bulto.cbm_order_numbers) ? bulto.cbm_order_numbers : [])
        .map(cleanValue)
        .filter((order: string) => order && !rows.has(order));
      const bultoCbm = Number(bulto.cargo_cbm || 0);
      if (orders.length === 0 || !(bultoCbm > 0)) return;
      const share = round4(bultoCbm / orders.length);
      orders.forEach((order: string) => rows.set(order, share));
    });
  }

  return Array.from(rows.entries())
    .map(([order_number, cbm]) => ({ order_number, cbm }))
    .sort((a, b) => a.order_number.localeCompare(b.order_number, 'es'));
}

// Shipping Mark del cliente; si no lo tiene, el guardado en la factura y, en
// último caso, el que traía la consolidación pagada.
export async function resolveShippingMark(base44: any, clientEmail: string, invoice: any, fallback = ''): Promise<string> {
  if (clientEmail) {
    const users = await base44.asServiceRole.entities.User
      .filter({ email: clientEmail }, '-created_date', 1)
      .catch(() => []);
    const mark = cleanValue(users?.[0]?.shipping_mark);
    if (mark) return mark;
  }
  return cleanValue(invoice?.warehouse_order?.shipping_mark) || cleanValue(fallback);
}

// Guarda la aprobación para el informe del día (sin repetirla) y devuelve el
// registro con el Shipping Mark y los N° de orden/envío de su factura.
export async function recordApprovedPayment(base44: any, input: ApprovalReportInput) {
  const approvedDate = new Date();
  const approvalDay = caracasDay(approvedDate);

  const existing = await base44.asServiceRole.entities.ApprovedPaymentReport
    .filter({ source_id: input.source_id, approval_day: approvalDay }, '-created_date', 1)
    .catch(() => []);
  if (existing && existing.length > 0) return existing[0];

  let invoice: any = null;
  if (input.invoice_id) {
    const invoices = await base44.asServiceRole.entities.Invoice
      .filter({ id: input.invoice_id }, '-created_date', 1)
      .catch(() => []);
    invoice = invoices?.[0] || null;
  }

  const clientEmail = input.client_email || invoice?.client_email || '';
  const [orderRows, shippingMark] = await Promise.all([
    resolveOrderCbm(base44, invoice),
    resolveShippingMark(base44, clientEmail, invoice, input.shipping_mark)
  ]);

  const orderCbm = orderRows.reduce((sum, row) => sum + Number(row.cbm || 0), 0);
  const invoiceTotalCbm = Number(invoice?.total_cbm ?? invoice?.cost_breakdown?.total_cbm ?? 0);
  const totalCbm = orderRows.length > 0 ? round4(orderCbm) : round4(invoiceTotalCbm);

  return await base44.asServiceRole.entities.ApprovedPaymentReport.create({
    payment_type: input.payment_type,
    source_id: input.source_id,
    approved_date: approvedDate.toISOString(),
    approval_day: approvalDay,
    client_email: clientEmail,
    shipping_mark: shippingMark,
    invoice_id: invoice?.id || input.invoice_id || '',
    invoice_number: cleanValue(input.invoice_number) || cleanValue(invoice?.invoice_number),
    order_numbers: orderRows.map((row) => row.order_number),
    order_cbm: orderRows,
    total_cbm: totalCbm,
    amount: Number(input.amount || 0),
    approved_by: input.approved_by || ''
  });
}

// Registra la aprobación y arma su TXT. El informe es un anexo: si algo falla
// aquí, la aprobación del pago sigue en pie.
export async function recordApprovalForReport(base44: any, input: ApprovalReportInput) {
  try {
    const entry = await recordApprovedPayment(base44, input);
    if (!entry) return null;
    return {
      entry,
      txt: buildReportText([entry], { title: 'PAGO APROBADO' }),
      filename: approvalReportFileName(entry)
    };
  } catch (_) {
    return null;
  }
}

function entryBlock(entry: any): string[] {
  const lines = [
    `Shipping Mark: ${cleanValue(entry.shipping_mark)}`,
    `Numero de orden/envio: ${(Array.isArray(entry.order_numbers) ? entry.order_numbers : []).join(', ')}`
  ];

  // CBM de cada orden/envío y CBM total de la factura pagada.
  const cbmRows = Array.isArray(entry.order_cbm) ? entry.order_cbm : [];
  if (cbmRows.length > 0) {
    lines.push(`CBM por orden/envio: ${cbmRows.map((row: any) => `${cleanValue(row.order_number)} (${formatCbm(row.cbm)} CBM)`).join(' | ')}`);
  }
  const totalCbm = entry.total_cbm != null
    ? Number(entry.total_cbm)
    : cbmRows.reduce((sum: number, row: any) => sum + Number(row.cbm || 0), 0);
  if (totalCbm > 0) lines.push(`Total CBM: ${formatCbm(totalCbm)}`);

  if (cleanValue(entry.invoice_number)) lines.push(`Factura: ${cleanValue(entry.invoice_number)}`);
  if (entry.amount != null) lines.push(`Monto: $${Number(entry.amount || 0).toFixed(2)}`);
  const stamp = caracasStamp(entry.approved_date);
  if (stamp) lines.push(`Aprobado: ${stamp}${entry.approved_by ? ` - ${entry.approved_by}` : ''}`);
  return lines;
}

// Mismo texto para la descarga de una aprobación, para la aprobación en bloque
// y para el informe acumulado del día.
export function buildReportText(entries: any[], meta: { title?: string; day?: string } = {}): string {
  const list = Array.isArray(entries) ? entries.filter(Boolean) : [];
  if (list.length === 0) return '';

  const lines: string[] = [meta.title || 'PAGOS APROBADOS'];
  if (meta.day) lines.push(`Fecha: ${formatDay(meta.day)}`);
  lines.push(`Pagos aprobados: ${list.length}`);

  list.forEach((entry) => {
    lines.push('');
    lines.push('----------------------------------------');
    lines.push(...entryBlock(entry));
  });

  lines.push('');
  return lines.join('\n');
}