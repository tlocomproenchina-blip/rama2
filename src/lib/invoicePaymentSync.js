/**
 * Utilidades para sincronizar registros de InvoicePayment cuando una factura
 * se marca como "pagada" directamente (editar factura o acción masiva).
 *
 * Esto asegura que todo pago aparezca en el Historial de AdminPayments.
 */

const METHOD_MAP = {
  stripe_invoice: 'stripe',
  stripe: 'stripe',
  binance: 'binance',
  usdt_trc20: 'usdt_trc20',
  paypal: 'paypal',
  debito_internacional: 'otro',
  wally: 'wally',
  zinli: 'zinli',
  wise: 'wise',
  skrill: 'skrill',
  pago_movil_usdt: 'pago_movil_usdt',
  transferencia: 'transferencia',
};

export const mapInvoiceMethodToPayment = (method) => {
  if (!method) return 'transferencia';
  return METHOD_MAP[String(method).toLowerCase()] || 'otro';
};

const isImageUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  return /^https?:\/\/.+\.(png|jpg|jpeg|webp|gif)/i.test(url);
};

/**
 * Garantiza que exista un InvoicePayment (status 'aprobado') para una factura pagada.
 * - Si la factura no está 'pagada', retorna null.
 * - Si ya existe un InvoicePayment para esa factura, lo retorna (evita duplicados).
 * - Si no existe, crea uno con los datos de la factura y retorna el nuevo registro.
 *
 * @param {object} b44       Instancia del SDK base44 (client o asServiceRole).
 * @param {object} invoice   La factura con status 'pagada'.
 * @param {string} adminEmail Email del admin que marca el pago.
 */
export const ensureInvoicePaymentForPaidInvoice = async (b44, invoice, adminEmail) => {
  if (!invoice || invoice.status !== 'pagada') return null;

  try {
    const existing = await b44.entities.InvoicePayment.filter({ invoice_id: invoice.id });
    if (existing && existing.length > 0) return existing[0];
  } catch {
    return null;
  }

  const paymentData = {
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number || '',
    client_email: invoice.client_email,
    amount: Number(invoice.total || 0),
    method: mapInvoiceMethodToPayment(invoice.payment_method),
    reference: invoice.payment_reference || '',
    status: 'aprobado',
    approved_date: invoice.payment_date || new Date().toISOString(),
    approved_by: adminEmail || 'sistema',
  };

  if (isImageUrl(invoice.payment_reference)) {
    paymentData.proof_url = invoice.payment_reference;
  }

  try {
    return await b44.entities.InvoicePayment.create(paymentData);
  } catch {
    return null;
  }
};