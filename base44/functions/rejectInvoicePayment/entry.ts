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
    const reason = payload.reason || '';
    if (!paymentId) {
      return Response.json({ error: 'Missing payment_id' }, { status: 400 });
    }

    const payments = await base44.asServiceRole.entities.InvoicePayment.filter({ id: paymentId });
    if (!payments || payments.length === 0) {
      return Response.json({ error: 'Abono no encontrado' }, { status: 404 });
    }
    const payment = payments[0];
    if (payment.status !== 'pendiente') {
      return Response.json({ error: `El abono ya fue ${payment.status}` }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    await base44.asServiceRole.entities.InvoicePayment.update(paymentId, {
      status: 'rechazado',
      reject_reason: reason,
      rejected_date: nowIso,
      approved_by: user.email
    });

    // Notificar al cliente
    try {
      await base44.asServiceRole.entities.Notification.create({
        user_email: payment.client_email,
        title: '❌ Abono rechazado',
        message: `Tu abono de $${Number(payment.amount).toFixed(2)} fue rechazado${reason ? `. Motivo: ${reason}` : ''}.`,
        type: 'payment',
        icon: 'alert',
        reference_id: payment.invoice_id,
        entity_type: 'Invoice'
      });
    } catch (_) {}

    // Email al cliente (no bloqueante)
    try {
      const invs = await base44.asServiceRole.entities.Invoice.filter({ id: payment.invoice_id });
      const invNumber = invs?.[0]?.invoice_number || '';
      await base44.asServiceRole.functions.invoke('sendNotificationEmail', {
        to: payment.client_email,
        subject: `Abono rechazado - ${invNumber}`,
        body: `Hola,\n\nTu abono de $${Number(payment.amount).toFixed(2)} para la factura ${invNumber} fue rechazado${reason ? `.\n\nMotivo: ${reason}` : ''}.\n\nPor favor intenta nuevamente.`,
        in_app: {
          title: 'Abono rechazado',
          message: `Abono de $${Number(payment.amount).toFixed(2)} rechazado`,
          type: 'payment',
          icon: 'alert',
          reference_id: payment.invoice_id
        }
      });
    } catch (_) {}

    return Response.json({ success: true });
  } catch (error) {
    const message = (error && typeof error === 'object' && 'message' in error) ? error.message : 'Internal Server Error';
    return Response.json({ error: String(message) }, { status: 500 });
  }
}