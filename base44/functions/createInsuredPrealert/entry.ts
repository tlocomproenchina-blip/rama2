import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (!user.shipping_mark) {
      return Response.json({ error: 'Necesitas un Shipping Mark asignado' }, { status: 403 });
    }

    const body = await req.json();
    const tracking = String(body.tracking_number || '').trim();
    const description = String(body.description || '').trim();
    const shippingCompany = String(body.shipping_company || '').trim();
    if (!shippingCompany) return Response.json({ error: 'Empresa de envío requerida' }, { status: 400 });
    if (!tracking) return Response.json({ error: 'Tracking requerido' }, { status: 400 });
    if (!description) return Response.json({ error: 'Descripción requerida' }, { status: 400 });

    const fobValue = parseFloat(body.fob_value) || 0;
    const insurancePercentage = parseFloat(body.insurance_percentage) || 5;
    const insuranceAmount = parseFloat(body.insurance_amount) || (fobValue * insurancePercentage / 100);
    if (insuranceAmount <= 0) {
      return Response.json({ error: 'El monto del seguro debe ser mayor a 0' }, { status: 400 });
    }

    // 1) Reclamo automático: si existe un huérfano con el mismo tracking, reclamarlo
    const existing = await base44.asServiceRole.entities.Package.filter({ tracking_number: tracking }, '-created_date', 1);
    const orphan = existing.find((p) => p.is_orphan);
    let pkgRecord;

    if (orphan) {
      const wasReceived = !!(orphan.warehouse_location_id || orphan.actual_weight_kg || orphan.received_date);
      const nextStatus = wasReceived ? 'recibido' : 'pre_alerta';
      pkgRecord = await base44.asServiceRole.entities.Package.update(orphan.id, {
        client_email: user.email,
        shipping_mark: user.shipping_mark,
        is_orphan: false,
        status: nextStatus,
        shipping_company: shippingCompany,
        shipping_type: body.shipping_type === 'maritimo' ? 'maritimo' : 'aereo',
        risk_category: body.risk_category === 'alto_riesgo' ? 'alto_riesgo' : 'general',
        package_count: Number(body.package_count) || 1,
        description,
        has_insurance: true,
        fob_value: fobValue,
        invoice_url: body.invoice_url || null,
        product_image_url: body.product_image_url || null,
        reported: true,
      });
    } else if (existing.length > 0) {
      return Response.json({ error: 'Este número de tracking ya ha sido registrado' }, { status: 409 });
    } else {
      pkgRecord = await base44.asServiceRole.entities.Package.create({
        tracking_number: tracking,
        shipping_company: shippingCompany,
        client_email: user.email,
        shipping_mark: user.shipping_mark,
        shipping_type: body.shipping_type === 'maritimo' ? 'maritimo' : 'aereo',
        risk_category: body.risk_category === 'alto_riesgo' ? 'alto_riesgo' : 'general',
        package_count: Number(body.package_count) || 1,
        description,
        has_insurance: true,
        fob_value: fobValue,
        invoice_url: body.invoice_url || null,
        product_image_url: body.product_image_url || null,
        status: 'pre_alerta'
      });
    }

    // 2) Crear el registro de pago del seguro (pendiente de validación)
    const insurancePayment = await base44.asServiceRole.entities.InsurancePayment.create({
      client_email: user.email,
      tracking_number: tracking,
      package_id: pkgRecord.id,
      fob_value: fobValue,
      insurance_percentage: insurancePercentage,
      amount: insuranceAmount,
      method: body.payment_method || 'transferencia',
      proof_url: body.proof_url || null,
      status: 'pendiente',
      reported_date: new Date().toISOString()
    });

    // 3) Notificar a los admins del nuevo pago de seguro pendiente
    try {
      await base44.asServiceRole.functions.invoke('notifyAdminsNewCase', {
        title: '🛡️ Pago de Seguro Pendiente',
        message: `Pago de seguro $${insuranceAmount.toFixed(2)} - Tracking: ${tracking} (${user.email})`,
        type: 'payment_validation',
        reference_id: insurancePayment.id,
        entity_type: 'Invoice'
      });
    } catch (_) {}

    return Response.json({ package: pkgRecord, insurance_payment: insurancePayment });
  } catch (error) {
    const message = (error && typeof error === 'object' && 'message' in error) ? error.message : 'Internal Server Error';
    return Response.json({ error: String(message) }, { status: 500 });
  }
}