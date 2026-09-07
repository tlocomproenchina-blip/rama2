import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // Buscar paquetes con deadline vencida y no marcados como expired
    const nowIso = new Date().toISOString();
    const candidates = await base44.asServiceRole.entities.Package.filter({
      insurance_deadline: { $lt: nowIso },
      insurance_expired: { $ne: true }
    }, '-updated_date', 200);

    if (!candidates || candidates.length === 0) {
      return Response.json({ success: true, expired: 0 });
    }

    // Cargar todos los InsurancePayment pendientes de esos paquetes en una sola consulta
    const packageIds = candidates.map((p) => p.id);
    const pendingPayments = await base44.asServiceRole.entities.InsurancePayment.filter({
      package_id: { $in: packageIds },
      status: 'pendiente'
    }, '-created_date', 500);

    const pendingPackageIds = new Set(pendingPayments.map((p) => p.package_id));

    let expiredCount = 0;
    for (const pkg of candidates) {
      // Si hay un pago pendiente, no expirar todavía (la cuenta se pausa mientras hay pago pendiente)
      if (pendingPackageIds.has(pkg.id)) continue;

      try {
        await base44.asServiceRole.entities.Package.update(pkg.id, {
          insurance_expired: true,
          has_insurance: false,
          insurance_deadline: null
        });
        expiredCount++;

        // Notificar al cliente que el seguro venció
        if (pkg.client_email) {
          try {
            await base44.asServiceRole.entities.Notification.create({
              user_email: pkg.client_email,
              title: '⏰ Seguro vencido',
              message: `El plazo de 12 horas para pagar el seguro del tracking ${pkg.tracking_number} ha vencido. El paquete queda sin seguro.`,
              type: 'payment',
              icon: 'alert',
              reference_id: pkg.id,
              entity_type: 'Package'
            });
          } catch (_) {}
        }
      } catch (_) {}
    }

    return Response.json({ success: true, expired: expiredCount, candidates: candidates.length });
  } catch (error) {
    const message = (error && typeof error === 'object' && 'message' in error) ? error.message : 'Internal Server Error';
    return Response.json({ error: String(message) }, { status: 500 });
  }
}