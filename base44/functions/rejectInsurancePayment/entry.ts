import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

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
    const reason = String(payload.reason || '').trim();
    if (!paymentId) {
      return Response.json({ error: 'Missing payment_id' }, { status: 400 });
    }

    const payments = await base44.asServiceRole.entities.InsurancePayment.filter({ id: paymentId });
    if (!payments || payments.length === 0) {
      return Response.json({ error: 'Pago de seguro no encontrado' }, { status: 404 });
    }
    const payment = payments[0];
    if (payment.status !== 'pendiente') {
      return Response.json({ error: `El pago ya fue ${payment.status}` }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    await base44.asServiceRole.entities.InsurancePayment.update(paymentId, {
      status: 'rechazado',
      reject_reason: reason,
      rejected_date: nowIso
    });

    // Notificar al cliente
    try {
      await base44.asServiceRole.entities.Notification.create({
        user_email: payment.client_email,
        title: '❌ Seguro rechazado',
        message: `El pago del seguro para el tracking ${payment.tracking_number} fue rechazado${reason ? `: ${reason}` : ''}. Puedes intentar nuevamente.`,
        type: 'payment',
        icon: 'alert',
        reference_id: paymentId,
        entity_type: 'Invoice'
      });
    } catch (_) {}

    return Response.json({ success: true, status: 'rechazado' });
  } catch (error) {
    const message = (error && typeof error === 'object' && 'message' in error) ? error.message : 'Internal Server Error';
    return Response.json({ error: String(message) }, { status: 500 });
  }
}