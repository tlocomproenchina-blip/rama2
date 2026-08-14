import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Crea una pre-alerta (Package con status "pre_alerta") automáticamente cuando
// el administrador carga el número de tracking en una solicitud de pago asistido.
// Recibe: { request_id, tracking_number }
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json();
    const requestId = String(body.request_id || '').trim();
    const trackingNumber = String(body.tracking_number || '').trim();
    if (!requestId) return Response.json({ error: 'request_id requerido' }, { status: 400 });
    if (!trackingNumber) return Response.json({ error: 'tracking_number requerido' }, { status: 400 });

    // Obtener la solicitud de pago asistido
    let apRequest = null;
    try {
      const requests = await base44.asServiceRole.entities.AssistedPaymentRequest.filter({ id: requestId }, '-created_date', 1);
      apRequest = requests?.[0];
    } catch (_) {}
    if (!apRequest) return Response.json({ error: 'Solicitud no encontrada' }, { status: 404 });

    // Si ya fue pre-alertada, no duplicar
    if (apRequest.tracking_prealerted && apRequest.tracking_number) {
      return Response.json({ error: 'Esta solicitud ya tiene una pre-alerta creada', tracking_number: apRequest.tracking_number }, { status: 409 });
    }

    // Verificar duplicados de tracking
    const existing = await base44.asServiceRole.entities.Package.filter({ tracking_number: trackingNumber }, '-created_date', 1);
    if (existing.length > 0) {
      return Response.json({ error: 'Este número de tracking ya está registrado en el sistema' }, { status: 409 });
    }

    // Obtener el shipping_mark del cliente
    const clientEmail = apRequest.client_email;
    let shippingMark = '';
    try {
      const clients = await base44.asServiceRole.entities.User.filter({ email: { $in: [clientEmail] } }, undefined, 5);
      shippingMark = clients?.[0]?.shipping_mark || '';
    } catch (_) {}

    // Crear la pre-alerta
    const descriptionParts = ['Pago asistido'];
    if (apRequest.request_number) descriptionParts.push(apRequest.request_number);
    if (apRequest.model_type) descriptionParts.push(apRequest.model_type);
    const description = descriptionParts.join(' - ');

    const newPackage = await base44.asServiceRole.entities.Package.create({
      tracking_number: trackingNumber,
      shipping_company: apRequest.provider || 'otro',
      client_email: clientEmail,
      shipping_mark: shippingMark,
      shipping_type: 'aereo',
      risk_category: 'general',
      package_count: apRequest.quantity || 1,
      description,
      has_insurance: false,
      fob_value: apRequest.amount || 0,
      product_image_url: apRequest.product_image_url || null,
      status: 'pre_alerta'
    });

    // Marcar la solicitud con el tracking y pre-alerta creada
    await base44.asServiceRole.entities.AssistedPaymentRequest.update(requestId, {
      tracking_number: trackingNumber,
      tracking_prealerted: true
    });

    return Response.json({
      package: newPackage,
      tracking_number: trackingNumber,
      prealerted: true
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});