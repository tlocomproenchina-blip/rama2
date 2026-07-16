import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
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

    // Verificar duplicados
    const existing = await base44.asServiceRole.entities.Package.filter({ tracking_number: tracking }, '-created_date', 1);
    if (existing.length > 0) {
      return Response.json({ error: 'Este número de tracking ya ha sido registrado' }, { status: 409 });
    }

    const newPackage = await base44.asServiceRole.entities.Package.create({
      tracking_number: tracking,
      shipping_company: shippingCompany,
      client_email: user.email,
      shipping_mark: user.shipping_mark,
      shipping_type: body.shipping_type === 'maritimo' ? 'maritimo' : 'aereo',
      risk_category: body.risk_category === 'alto_riesgo' ? 'alto_riesgo' : 'general',
      package_count: Number(body.package_count) || 1,
      description,
      has_insurance: !!body.has_insurance,
      fob_value: parseFloat(body.fob_value) || 0,
      invoice_url: body.invoice_url || null,
      product_image_url: body.product_image_url || null,
      status: 'pre_alerta'
    });

    return Response.json({ package: newPackage });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});