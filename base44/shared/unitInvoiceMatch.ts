// Busca la factura que cubre una unidad (bulto o caja) para conservarla al desarmar.
// Puntaje: etiqueta en la orden de almacén de la factura > N° de orden en sus recibos >
// trackings en común con sus recibos. Gana la factura con más puntaje.
const text = (value: any) => String(value ?? '').trim();

export async function loadClientInvoices(base44: any, clientEmail: string) {
  if (!text(clientEmail)) return [];
  const rows = await base44.asServiceRole.entities.Invoice
    .filter({ client_email: text(clientEmail), status: { $ne: 'cancelada' } }, '-invoice_date', 200)
    .catch(() => []);
  return (rows || []).map((inv: any) => {
    const recibos = Array.isArray(inv.manual_recibos) ? inv.manual_recibos : [];
    const groups = Array.isArray(inv.warehouse_order?.groups) ? inv.warehouse_order.groups : [];
    return {
      id: inv.id,
      invoice_number: text(inv.invoice_number),
      status: text(inv.status),
      orders: new Set(recibos.map((r: any) => text(r.invoice_number)).filter(Boolean)),
      trackings: new Set(recibos.flatMap((r: any) => r.tracking_numbers || []).map(text).filter(Boolean)),
      labels: new Set(groups.flatMap((g: any) => g.bultos || []).map((b: any) => text(b.label_code)).filter(Boolean)),
    };
  });
}

// Devuelve los campos de factura que debe llevar la unidad: la factura que la cubre
// (pagada o no) o "pendiente" si ninguna factura la incluye.
export function invoiceFieldsFor(invoices: any[], unit: { labels: string[]; orders: string[]; trackings: string[] }) {
  let best: any = null;
  let bestScore = 0;
  for (const inv of invoices) {
    const byLabel = unit.labels.some((l) => inv.labels.has(text(l))) ? 1000 : 0;
    const byOrder = unit.orders.filter((o) => inv.orders.has(text(o))).length * 100;
    const byTrk = unit.trackings.filter((t) => inv.trackings.has(text(t))).length;
    const score = byLabel + byOrder + byTrk;
    if (score > bestScore) { best = inv; bestScore = score; }
  }
  if (!best) {
    return { billed_invoice_id: null, invoice_number: '', invoice_status: 'pendiente', invoice_paid: false };
  }
  return {
    billed_invoice_id: best.id,
    invoice_number: best.invoice_number,
    invoice_status: best.status,
    invoice_paid: best.status === 'pagada',
  };
}