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
    if (!paymentId) {
      return Response.json({ error: 'Missing payment_id' }, { status: 400 });
    }

    // Cargar el pago de seguro
    const payments = await base44.asServiceRole.entities.InsurancePayment.filter({ id: paymentId });
    if (!payments || payments.length === 0) {
      return Response.json({ error: 'Pago de seguro no encontrado' }, { status: 404 });
    }
    const payment = payments[0];
    if (payment.status !== 'pendiente') {
      return Response.json({ error: `El pago ya fue ${payment.status}` }, { status: 400 });
    }

    const nowIso = new Date().toISOString();

    // Aprobar el pago del seguro
    await base44.asServiceRole.entities.InsurancePayment.update(paymentId, {
      status: 'aprobado',
      approved_date: nowIso,
      approved_by: user.email
    });

    // Marcar automáticamente el paquete como asegurado
    if (payment.package_id) {
      try {
        await base44.asServiceRole.entities.Package.update(payment.package_id, {
          has_insurance: true
        });
      } catch (_) {}
    }

    // Notificar al cliente
    try {
      await base44.asServiceRole.entities.Notification.create({
        user_email: payment.client_email,
        title: '🛡️ Seguro aprobado',
        message: `El pago del seguro para el tracking ${payment.tracking_number} fue aprobado. Tu paquete está asegurado.`,
        type: 'payment',
        icon: 'check',
        reference_id: paymentId,
        entity_type: 'Invoice'
      });
    } catch (_) {}

    // Email al cliente (no bloqueante)
    try {
      await base44.asServiceRole.functions.invoke('sendNotificationEmail', {
        to: payment.client_email,
        subject: `Seguro aprobado - ${payment.tracking_number}`,
        body: `Hola,\n\nEl pago de tu seguro de $${Number(payment.amount).toFixed(2)} para el tracking ${payment.tracking_number} fue aprobado.\n\nTu paquete está asegurado correctamente.`,
        in_app: {
          title: 'Seguro aprobado',
          message: `Seguro de ${payment.tracking_number} aprobado`,
          type: 'payment',
          icon: 'check',
          reference_id: paymentId
        }
      });
    } catch (_) {}

    return Response.json({ success: true, status: 'aprobado' });
  } catch (error) {
    const message = (error && typeof error === 'object' && 'message' in error) ? error.message : 'Internal Server Error';
    return Response.json({ error: String(message) }, { status: 500 });
  }
}