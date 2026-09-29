// Lógica única de aprobación de pagos de TLEC CARGO.
// La usan las funciones de aprobación individual (approveInvoicePayment,
// approveInsurancePayment) y la aprobación masiva (bulkApprovePayments), de modo que
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

// ---------- Abonos (InvoicePayment) ----------
export async function approveAbonoPayment(base44: any, paymentId: string, adminEmail: string) {
  const payments = await base44.asServiceRole.entities.InvoicePayment.filter({ id: paymentId });
  if (!payments || payments.length === 0) fail('Abono no encontrado', 404);
  const payment = payments[0];
  if (payment.status !== 'pendiente') fail(`El abono ya fue ${payment.status}`, 400);

  // Verificar que las órdenes de despacho de este abono no estén ya pagadas
  // por otro abono aprobado (evita doble pago)
  const paymentOrderIds = Array.isArray(payment.dispatch_order_ids) ? payment.dispatch_order_ids : [];
  if (paymentOrderIds.length > 0) {
    const existingPayments = await base44.asServiceRole.entities.InvoicePayment
      .filter({ invoice_id: payment.invoice_id }, '-created_date', 200)
      .catch(() => []);
    const alreadyPaidIds = new Set<string>();
    (existingPayments || []).forEach((p: any) => {
      if (p.status === 'aprobado' && p.id !== paymentId && Array.isArray(p.dispatch_order_ids)) {
        p.dispatch_order_ids.forEach((id: any) => alreadyPaidIds.add(String(id)));
      }
    });
    const conflicts = paymentOrderIds.filter((id: any) => alreadyPaidIds.has(String(id)));
    if (conflicts.length > 0) fail('Una o más órdenes de despacho ya fueron pagadas en otro abono aprobado', 400);
  }

  const nowIso = new Date().toISOString();
  await base44.asServiceRole.entities.InvoicePayment.update(paymentId, {
    status: 'aprobado',
    approved_date: nowIso,
    approved_by: adminEmail
  });

  // Recalcular paid_amount sumando todos los abonos aprobados de la factura
  const allPayments = await base44.asServiceRole.entities.InvoicePayment.filter({ invoice_id: payment.invoice_id });
  const paidAmount = (allPayments || [])
    .filter((p: any) => p.status === 'aprobado')
    .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

  const invs = await base44.asServiceRole.entities.Invoice.filter({ id: payment.invoice_id });
  if (!invs || invs.length === 0) fail('Factura no encontrada', 404);
  const invoice = invs[0];
  const total = Number(invoice.total || 0);
  const newPaidAmount = Math.round(paidAmount * 100) / 100;
  const isFullyPaid = newPaidAmount >= total;

  const updatePayload: any = { paid_amount: newPaidAmount };
  if (isFullyPaid && invoice.status !== 'pagada') {
    updatePayload.status = 'pagada';
    updatePayload.payment_date = nowIso;
    updatePayload.payment_method = payment.method;
    if (payment.reference) updatePayload.payment_reference = payment.reference;
  }
  await base44.asServiceRole.entities.Invoice.update(invoice.id, updatePayload);

  const balance = Math.max(0, total - newPaidAmount);
  const amountText = Number(payment.amount || 0).toFixed(2);
  await notifyClient(base44, {
    to: payment.client_email,
    subject: isFullyPaid ? `Factura ${invoice.invoice_number || ''} pagada` : `Abono aprobado - ${invoice.invoice_number || ''}`,
    body: isFullyPaid
      ? `Hola,\n\nTu factura ${invoice.invoice_number || ''} por $${total.toFixed(2)} está completamente pagada. ¡Gracias por tu pago!`
      : `Hola,\n\nTu abono de $${amountText} para la factura ${invoice.invoice_number || ''} fue aprobado.\n\nTotal factura: $${total.toFixed(2)}\nPagado: $${newPaidAmount.toFixed(2)}\nSaldo restante: $${balance.toFixed(2)}`,
    title: isFullyPaid ? '✅ Factura pagada' : '✅ Abono aprobado',
    message: isFullyPaid
      ? `Tu factura ${invoice.invoice_number || ''} está completamente pagada. ¡Gracias!`
      : `Tu abono de $${amountText} para la factura ${invoice.invoice_number || ''} fue aprobado. Saldo restante: $${balance.toFixed(2)}.`,
    referenceId: invoice.id
  });

  return {
    success: true,
    paid_amount: newPaidAmount,
    invoice_status: isFullyPaid ? 'pagada' : (invoice.status === 'pagada' ? 'pagada' : invoice.status),
    fully_paid: isFullyPaid
  };
}

// ---------- Pagos reportados en facturas (factura en 'revision') ----------
export async function approveReportedInvoicePayment(base44: any, invoiceId: string) {
  const invs = await base44.asServiceRole.entities.Invoice.filter({ id: invoiceId });
  if (!invs || invs.length === 0) fail('Factura no encontrada', 404);
  const invoice = invs[0];
  if (invoice.status !== 'revision') fail(`La factura ya no está en revisión (${invoice.status})`, 400);

  const nowIso = new Date().toISOString();
  await base44.asServiceRole.entities.Invoice.update(invoiceId, {
    status: 'pagada',
    payment_date: nowIso,
    payment_method: invoice.payment_method || 'transferencia'
  });

  await notifyClient(base44, {
    to: invoice.client_email,
    subject: '✅ Pago validado',
    body: `¡Excelente! Tu pago de la factura ${invoice.invoice_number} por $${Number(invoice.total || 0).toFixed(2)} ha sido validado.`,
    title: '✅ Pago Validado',
    message: `Tu pago de la factura ${invoice.invoice_number} ha sido validado.`,
    referenceId: invoiceId
  });

  return { success: true };
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
  }

  await notifyClient(base44, {
    to: cons.client_email,
    subject: '✅ Pago validado - Tu carga está en camino',
    body: `¡Excelente! Tu pago ha sido validado.\n\nTracking: ${cons.consolidation_tracking}\nMonto: $${cons.payment_amount}\n\nTu carga está ahora en tránsito.`,
    title: '✅ Pago Validado',
    message: `Tu pago de $${cons.payment_amount} para ${cons.consolidation_tracking} ha sido validado.`,
    referenceId: cons.id
  });

  return { success: true };
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