import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    let payload = {};
    try { payload = await req.json(); } catch (_) { payload = {}; }
    const paymentId = payload.payment_id;
    if (!paymentId) {
      return Response.json({ error: 'Missing payment_id' }, { status: 400 });
    }

    // Cargar el abono
    const payments = await base44.asServiceRole.entities.InvoicePayment.filter({ id: paymentId });
    if (!payments || payments.length === 0) {
      return Response.json({ error: 'Abono no encontrado' }, { status: 404 });
    }
    const payment = payments[0];
    if (payment.status !== 'pendiente') {
      return Response.json({ error: `El abono ya fue ${payment.status}` }, { status: 400 });
    }

    // Verificar que las órdenes de despacho de este abono no estén ya pagadas
    // por otro abono aprobado (evita doble pago)
    const paymentOrderIds = Array.isArray(payment.dispatch_order_ids) ? payment.dispatch_order_ids : [];
    if (paymentOrderIds.length > 0) {
      const existingPayments = await base44.asServiceRole.entities.InvoicePayment.filter(
        { invoice_id: payment.invoice_id },
        '-created_date',
        200
      ).catch(() => []);
      const alreadyPaidIds = new Set();
      (existingPayments || []).forEach((p) => {
        if (p.status === 'aprobado' && p.id !== paymentId && Array.isArray(p.dispatch_order_ids)) {
          p.dispatch_order_ids.forEach((id) => alreadyPaidIds.add(String(id)));
        }
      });
      const conflicts = paymentOrderIds.filter((id) => alreadyPaidIds.has(String(id)));
      if (conflicts.length > 0) {
        return Response.json(
          { error: `Una o más órdenes de despacho ya fueron pagadas en otro abono aprobado` },
          { status: 400 }
        );
      }
    }

    // Aprobar el abono
    const nowIso = new Date().toISOString();
    await base44.asServiceRole.entities.InvoicePayment.update(paymentId, {
      status: 'aprobado',
      approved_date: nowIso,
      approved_by: user.email
    });

    // Recalcular paid_amount sumando todos los abonos aprobados de la factura
    const allPayments = await base44.asServiceRole.entities.InvoicePayment.filter({ invoice_id: payment.invoice_id });
    const paidAmount = (allPayments || [])
      .filter((p) => p.status === 'aprobado')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    // Cargar la factura
    const invs = await base44.asServiceRole.entities.Invoice.filter({ id: payment.invoice_id });
    if (!invs || invs.length === 0) {
      return Response.json({ error: 'Factura no encontrada' }, { status: 404 });
    }
    const invoice = invs[0];
    const total = Number(invoice.total || 0);
    const newPaidAmount = Math.round(paidAmount * 100) / 100;

    // Si la suma de abonos cubre el total, marcar factura como pagada
    const isFullyPaid = newPaidAmount >= total;
    const updatePayload = { paid_amount: newPaidAmount };
    if (isFullyPaid && invoice.status !== 'pagada') {
      updatePayload['status'] = 'pagada';
      updatePayload['payment_date'] = nowIso;
      updatePayload['payment_method'] = payment.method;
      if (payment.reference) updatePayload['payment_reference'] = payment.reference;
    }

    await base44.asServiceRole.entities.Invoice.update(invoice.id, updatePayload);

    // Notificar al cliente
    try {
      const balance = Math.max(0, total - newPaidAmount);
      const title = isFullyPaid ? '✅ Factura pagada' : '✅ Abono aprobado';
      const message = isFullyPaid
        ? `Tu factura ${invoice.invoice_number || ''} está completamente pagada. ¡Gracias!`
        : `Tu abono de $${Number(payment.amount).toFixed(2)} para la factura ${invoice.invoice_number || ''} fue aprobado. Saldo restante: $${balance.toFixed(2)}.`;

      await base44.asServiceRole.entities.Notification.create({
        user_email: payment.client_email,
        title,
        message,
        type: 'payment',
        icon: 'check',
        reference_id: invoice.id,
        entity_type: 'Invoice'
      });
    } catch (_) {}

    // Email al cliente (no bloqueante)
    try {
      await base44.asServiceRole.functions.invoke('sendNotificationEmail', {
        to: payment.client_email,
        subject: isFullyPaid ? `Factura ${invoice.invoice_number || ''} pagada` : `Abono aprobado - ${invoice.invoice_number || ''}`,
        body: isFullyPaid
          ? `Hola,\n\nTu factura ${invoice.invoice_number || ''} por $${total.toFixed(2)} está completamente pagada. ¡Gracias por tu pago!`
          : `Hola,\n\nTu abono de $${Number(payment.amount).toFixed(2)} para la factura ${invoice.invoice_number || ''} fue aprobado.\n\nTotal factura: $${total.toFixed(2)}\nPagado: $${newPaidAmount.toFixed(2)}\nSaldo restante: $${Math.max(0, total - newPaidAmount).toFixed(2)}`,
        in_app: {
          title: isFullyPaid ? 'Factura pagada' : 'Abono aprobado',
          message: isFullyPaid
            ? `Factura ${invoice.invoice_number || ''} pagada completamente`
            : `Abono de $${Number(payment.amount).toFixed(2)} aprobado`,
          type: 'payment',
          icon: 'check',
          reference_id: invoice.id
        }
      });
    } catch (_) {}

    return Response.json({
      success: true,
      paid_amount: newPaidAmount,
      invoice_status: isFullyPaid ? 'pagada' : (invoice.status === 'pagada' ? 'pagada' : invoice.status),
      fully_paid: isFullyPaid
    });
  } catch (error) {
    const message = (error && typeof error === 'object' && 'message' in error) ? error.message : 'Internal Server Error';
    return Response.json({ error: String(message) }, { status: 500 });
  }
}