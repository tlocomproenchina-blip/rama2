import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const packageId = String(body.package_id || '').trim();
    const proofUrl = String(body.proof_url || '').trim();
    const method = String(body.method || 'transferencia').trim();

    if (!packageId) return Response.json({ error: 'Falta package_id' }, { status: 400 });
    if (!proofUrl) return Response.json({ error: 'Falta el comprobante de pago' }, { status: 400 });

    // Cargar el paquete y verificar pertenencia
    const pkgs = await base44.asServiceRole.entities.Package.filter({ id: packageId });
    if (!pkgs || pkgs.length === 0) {
      return Response.json({ error: 'Paquete no encontrado' }, { status: 404 });
    }
    const pkg = pkgs[0];
    if (pkg.client_email !== user.email) {
      return Response.json({ error: 'No tienes permiso sobre este paquete' }, { status: 403 });
    }

    // No permitir reintento si el seguro ya está aprobado o vencido
    if (pkg.has_insurance) {
      return Response.json({ error: 'Este paquete ya está asegurado' }, { status: 400 });
    }
    if (pkg.insurance_expired) {
      return Response.json({ error: 'El plazo para pagar el seguro de este paquete ha vencido' }, { status: 400 });
    }

    const fobValue = parseFloat(pkg.fob_value) || 0;
    if (fobValue <= 0) {
      return Response.json({ error: 'El paquete no tiene valor FOB para asegurar' }, { status: 400 });
    }

    // Obtener porcentaje de seguro de la config
    let insurancePercentage = 5;
    try {
      const configs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1);
      if (configs[0]?.insurance_percentage) {
        insurancePercentage = parseFloat(configs[0].insurance_percentage) || 5;
      }
    } catch (_) {}

    const insuranceAmount = fobValue * (insurancePercentage / 100);

    // Crear nuevo registro de InsurancePayment pendiente
    const insurancePayment = await base44.asServiceRole.entities.InsurancePayment.create({
      client_email: user.email,
      tracking_number: pkg.tracking_number,
      package_id: pkg.id,
      fob_value: fobValue,
      insurance_percentage: insurancePercentage,
      amount: insuranceAmount,
      method,
      proof_url: proofUrl,
      status: 'pendiente',
      reported_date: new Date().toISOString()
    });

    // Notificar a los admins del nuevo pago de seguro pendiente
    try {
      await base44.asServiceRole.functions.invoke('notifyAdminsNewCase', {
        title: '🛡️ Pago de Seguro Pendiente (reintento)',
        message: `Pago de seguro $${insuranceAmount.toFixed(2)} - Tracking: ${pkg.tracking_number} (${user.email})`,
        type: 'payment_validation',
        reference_id: insurancePayment.id,
        entity_type: 'Invoice'
      });
    } catch (_) {}

    return Response.json({ success: true, insurance_payment: insurancePayment });
  } catch (error) {
    const message = (error && typeof error === 'object' && 'message' in error) ? error.message : 'Internal Server Error';
    return Response.json({ error: String(message) }, { status: 500 });
  }
}