import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let payload = {};
    try { payload = await req.json(); } catch (_) { payload = {}; }

    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const requestId = payload.request_id;
    if (!requestId) {
      return Response.json({ error: 'Missing request_id' }, { status: 400 });
    }

    // Load request and app config
    const [reqs, cfgs] = await Promise.all([
      base44.asServiceRole.entities.AssistedPaymentRequest.filter({ id: requestId }),
      base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' }).catch(() => [])
    ]);

    if (!reqs || reqs.length === 0) {
      return Response.json({ error: 'AssistedPaymentRequest not found' }, { status: 404 });
    }

    const apReq = reqs[0];
    if (apReq.invoice_id) {
      return Response.json({ success: true, invoice_id: apReq.invoice_id, already_exists: true });
    }

    const cfg = cfgs?.[0] || {};

    const baseAmount = Number(apReq.amount || 0);
    const percent = Number(apReq.fee_percentage ?? cfg.payments_assisted_fee_percentage ?? 5);
    const feeAmount = Number(
      apReq.fee_amount ?? Math.round(baseAmount * (percent / 100) * 100) / 100
    );
    const total = Math.round((baseAmount + feeAmount) * 100) / 100;

    const nowIso = new Date().toISOString();
    const dueMs = 7 * 24 * 60 * 60 * 1000; // 7 days
    const dueIso = new Date(Date.now() + dueMs).toISOString();

    // Nomenclatura de factura ajustada al servicio de Pago Asistido
    const invoiceNumber = `INV-PA-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Create local Invoice with 2 items
    const invoice = await base44.asServiceRole.entities.Invoice.create({
      client_email: apReq.client_email,
      consolidation_id: apReq.id,
      consolidation_tracking: `AP-${String(apReq.id).slice(0, 8).toUpperCase()}`,
      invoice_number: invoiceNumber,
      invoice_date: nowIso,
      due_date: dueIso,
      items: [
        {
          description: 'Pago asistido - Monto base',
          quantity: 1,
          unit_price: baseAmount,
          total: baseAmount,
          details: {
            request_type: 'assisted_payment',
            provider: apReq.provider,
            link_url: apReq.link_url,
            qr_url: apReq.image_url,
            client_email: apReq.client_email,
            notes: apReq.notes,
            request_id: apReq.id,
          }
        },
        {
          description: `Comisión de servicio (${percent}%)`,
          quantity: 1,
          unit_price: feeAmount,
          total: feeAmount,
          details: {
            request_type: 'assisted_payment',
            provider: apReq.provider,
            qr_url: apReq.image_url,
            client_email: apReq.client_email,
            reference: 'assisted_payment_fee',
            request_id: apReq.id,
          }
        }
      ],
      subtotal: baseAmount + feeAmount,
      tax: 0,
      total: total,
      status: 'pendiente',
      notes: `Pago asistido — Cliente: ${apReq.client_email || 'N/A'} — Plataforma: ${apReq.provider || 'N/A'} — Enlace: ${apReq.link_url || 'N/A'} — QR: ${apReq.image_url || 'N/A'} — Notas: ${apReq.notes || 'N/A'}`
    });

    // Link back to request
    await base44.asServiceRole.entities.AssistedPaymentRequest.update(apReq.id, {
      status: 'en_proceso',
      invoice_id: invoice.id
    });

    // Notificar al cliente que su factura está lista (Stripe descontinuado:
    // el cliente paga con los métodos habilitados desde su portal).
    try {
      await base44.asServiceRole.entities.Notification.create({
        user_email: apReq.client_email,
        title: '🧾 Factura de pago asistido lista',
        message: `Tu factura ${invoiceNumber} por $${total.toFixed(2)} está disponible. Ingresa a tus facturas para ver los métodos de pago habilitados.`,
        type: 'payment',
        icon: 'dollar',
        reference_id: invoice.id,
        entity_type: 'Invoice'
      });
    } catch (_) {}

    // Enviar email al cliente (no bloqueante)
    try {
      await base44.asServiceRole.functions.invoke('sendNotificationEmail', {
        to: apReq.client_email,
        subject: `Factura de pago asistido ${invoiceNumber}`,
        body: `Hola,\n\nTu solicitud de pago asistido fue aprobada. Se generó la factura ${invoiceNumber} por un total de $${total.toFixed(2)}.\n\nIngresa a tu portal de TLEC CARGO para revisar los métodos de pago disponibles y completar el pago.\n\nGracias.`,
        in_app: {
          title: 'Factura de pago asistido lista',
          message: `Factura ${invoiceNumber} por $${total.toFixed(2)}`,
          type: 'payment',
          icon: 'dollar',
          reference_id: invoice.id
        }
      });
    } catch (_) {}

    return Response.json({
      success: true,
      invoice_id: invoice.id,
      invoice_number: invoiceNumber
    });
  } catch (error) {
    const message = (error && typeof error === 'object' && 'message' in error) ? error.message : 'Internal Server Error';
    return Response.json({ error: String(message) }, { status: 500 });
  }
});