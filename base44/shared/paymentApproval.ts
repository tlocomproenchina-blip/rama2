import { buildWarehouseOrderOnPayment } from "./warehouseOrder.ts";
import { recordApprovalForReport } from "./paymentReport.ts";

// Lógica única de aprobación de pagos de IMPORTACIONES TLEC CARGO.
// La usan la aprobación individual de seguros (approveInsurancePayment) y la aprobación masiva (bulkApprovePayments), de modo que
// aprobar en bloque tenga exactamente el mismo efecto que aprobar de a uno.
// Módulo plano: solo exporta utilidades (sin Deno.serve).

export function errorMessage(error: any) {
  return (error && typeof error === 'object' && 'message' in error) ? String((error as any).message) : 'Internal Server Error';
}

// Estado HTTP de un error de negocio lanzado por este módulo (400/404); 500 si es inesperado.
export function approvalErrorStatus(error: any, fallback = 500) {
  const status = Number((error as any)?.status);
  return Number.isFinite(status) && status >= 400 ? status : fallback;
}

function fail(message: string, status = 400): never {
  const error = new Error(message);
  (error as any).status = status;
  throw error;
}

// Email + notificación in-app + push al cliente (best effort, nunca rompe la aprobación).
async function notifyClient(base44: any, data: any) {
  try {
    await base44.asServiceRole.functions.invoke('sendNotificationEmail', {
      to: data.to,
      subject: data.subject,
      body: data.body,
      in_app: {
        user_email: data.to,
        title: data.title,
        message: data.message,
        type: 'payment',
        icon: 'check',
        reference_id: data.referenceId || null,
        entity_type: 'Invoice'
      }
    });
  } catch (_) {}
}

// ---------- Pagos reportados en facturas (factura en 'revision') ----------
export async function approveReportedInvoicePayment(base44: any, invoiceId: string, adminEmail = '') {
  const invs = await base44.asServiceRole.entities.Invoice.filter({ id: invoiceId });
  if (!invs || invs.length === 0) fail('Factura no encontrada', 404);
  const invoice = invs[0];
  if (invoice.status !== 'revision') fail(`La factura ya no está en revisión (${invoice.status})`, 400);

  // Sin abonos: validar el pago reportado significa que la factura quedó pagada al 100%.
  const nowIso = new Date().toISOString();
  await base44.asServiceRole.entities.Invoice.update(invoiceId, {
    status: 'pagada',
    paid_amount: Math.round(Number(invoice.total || 0) * 100) / 100,
    payment_date: nowIso,
    payment_method: invoice.payment_method || 'transferencia'
  });

  // La factura quedó pagada: se arma y guarda su orden de almacén (nunca la duplica).
  const warehouse: any = await buildWarehouseOrderOnPayment(base44, invoiceId, adminEmail);
  const warehouseStatus = warehouse?.order ? 'creada'
    : warehouse?.skipped === 'exists' ? 'existente'
    : warehouse?.empty ? 'sin_bultos'
    : 'error';

  await notifyClient(base44, {
    to: invoice.client_email,
    subject: '✅ Pago validado',
    body: `¡Excelente! Tu pago de la factura ${invoice.invoice_number} por $${Number(invoice.total || 0).toFixed(2)} ha sido validado.`,
    title: '✅ Pago Validado',
    message: `Tu pago de la factura ${invoice.invoice_number} ha sido validado.`,
    referenceId: invoiceId
  });

  // Anexo del informe: shipping mark y N° de contenedor de la factura pagada.
  const report = await recordApprovalForReport(base44, {
    payment_type: 'factura',
    source_id: invoiceId,
    client_email: invoice.client_email,
    invoice_id: invoiceId,
    invoice_number: invoice.invoice_number,
    amount: Number(invoice.total || 0),
    approved_by: adminEmail
  });

  return {
    success: true,
    invoice_number: invoice.invoice_number || '',
    warehouse_order_status: warehouseStatus,
    report_entry: report?.entry || null,
    report_txt: report?.txt || '',
    report_filename: report?.filename || ''
  };
}

// ---------- Pagos reportados en consolidaciones ----------
export async function approveConsolidationPayment(base44: any, consolidationId: string, adminEmail: string) {
  const rows = await base44.asServiceRole.entities.Consolidation.filter({ id: consolidationId });
  if (!rows || rows.length === 0) fail('Consolidación no encontrada', 404);
  const cons = rows[0];
  if (cons.status !== 'pago_pendiente_validacion') {
    fail(`La consolidación ya no está pendiente de validación (${cons.status})`, 400);
  }

  const nowIso = new Date().toISOString();
  await base44.asServiceRole.entities.Consolidation.update(consolidationId, {
    payment_validated: true,
    payment_validated_by: adminEmail,
    payment_validation_date: nowIso,
    status: 'en_transito'
  });

  for (const pkgId of (cons.package_ids || [])) {
    await base44.asServiceRole.entities.Package.update(pkgId, { status: 'en_transito' });
  }

  const relatedInvoices = await base44.asServiceRole.entities.Invoice.filter({ consolidation_id: consolidationId });
  if (relatedInvoices && relatedInvoices.length > 0) {
    await base44.asServiceRole.entities.Invoice.update(relatedInvoices[0].id, {
      status: 'pagada',
      payment_date: nowIso,
      payment_method: cons.payment_method || relatedInvoices[0].payment_method || 'transferencia'
    });

    // La factura de la consolidación quedó pagada: se arma y guarda su orden de almacén.
    await buildWarehouseOrderOnPayment(base44, relatedInvoices[0].id, adminEmail);
  }

  await notifyClient(base44, {
    to: cons.client_email,
    subject: '✅ Pago validado - Tu carga está en camino',
    body: `¡Excelente! Tu pago ha sido validado.\n\nTracking: ${cons.consolidation_tracking}\nMonto: $${cons.payment_amount}\n\nTu carga está ahora en tránsito.`,
    title: '✅ Pago Validado',
    message: `Tu pago de $${cons.payment_amount} para ${cons.consolidation_tracking} ha sido validado.`,
    referenceId: cons.id
  });

  // Anexo del informe: shipping mark y N° de contenedor de la factura pagada.
  const paidInvoice = (relatedInvoices && relatedInvoices.length > 0) ? relatedInvoices[0] : null;
  const report = await recordApprovalForReport(base44, {
    payment_type: 'consolidacion',
    source_id: consolidationId,
    client_email: cons.client_email,
    invoice_id: paidInvoice?.id || '',
    invoice_number: paidInvoice?.invoice_number || '',
    amount: Number(cons.payment_amount || 0),
    approved_by: adminEmail,
    shipping_mark: cons.shipping_mark
  });

  return {
    success: true,
    report_entry: report?.entry || null,
    report_txt: report?.txt || '',
    report_filename: report?.filename || ''
  };
}

// ---------- Seguros (InsurancePayment) ----------
export async function approveInsurancePaymentRecord(base44: any, paymentId: string, adminEmail: string) {
  const payments = await base44.asServiceRole.entities.InsurancePayment.filter({ id: paymentId });
  if (!payments || payments.length === 0) fail('Pago de seguro no encontrado', 404);
  const payment = payments[0];
  if (payment.status !== 'pendiente') fail(`El pago ya fue ${payment.status}`, 400);

  const nowIso = new Date().toISOString();
  await base44.asServiceRole.entities.InsurancePayment.update(paymentId, {
    status: 'aprobado',
    approved_date: nowIso,
    approved_by: adminEmail
  });

  // Marcar automáticamente el paquete como asegurado y limpiar deadline/expired
  if (payment.package_id) {
    try {
      await base44.asServiceRole.entities.Package.update(payment.package_id, {
        has_insurance: true,
        insurance_deadline: null,
        insurance_expired: false
      });
    } catch (_) {}
  }

  await notifyClient(base44, {
    to: payment.client_email,
    subject: `Seguro aprobado - ${payment.tracking_number}`,
    body: `Hola,\n\nEl pago de tu seguro de $${Number(payment.amount || 0).toFixed(2)} para el tracking ${payment.tracking_number} fue aprobado.\n\nTu paquete está asegurado correctamente.`,
    title: '🛡️ Seguro aprobado',
    message: `El pago del seguro para el tracking ${payment.tracking_number} fue aprobado. Tu paquete está asegurado.`,
    referenceId: paymentId
  });

  return { success: true, status: 'aprobado' };
}