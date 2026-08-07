import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { sendBrevoEmail } from '../../shared/brevoEmail.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only admin can trigger this
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const config = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' });

    // Check if auto consolidation is enabled
    if (config[0]?.auto_consolidation_enabled === false) {
      return Response.json({
        success: true,
        skipped: true,
        message: 'Consolidación automática desactivada en configuración'
      });
    }

    // Get all consolidation requests that are pending
    const pendingRequests = await base44.asServiceRole.entities.ConsolidationRequest.filter({
      status: 'pendiente'
    });
    const consolidationPeriods = config[0]?.consolidation_periods || [15, 20, 30];
    const defaultPeriodDays = consolidationPeriods[0] || 30;

    const now = new Date();
    const results = [];

    for (const request of pendingRequests) {
      // Get packages for this client that are in pre_alerta status
      const packages = await base44.asServiceRole.entities.Package.filter({
        client_email: request.client_email
      });

      // Filter received packages from this request
      const receivedPackages = packages.filter(p => 
        request.package_ids?.includes(p.id) && p.status === 'recibido'
      );

      if (receivedPackages.length === 0) continue;

      // Check if consolidation period has expired
      const firstReceivedDate = new Date(Math.min(...receivedPackages.map(p => new Date(p.received_date).getTime())));
      const expirationDate = new Date(firstReceivedDate.getTime() + defaultPeriodDays * 24 * 60 * 60 * 1000);

      if (now >= expirationDate) {
        await base44.asServiceRole.entities.ConsolidationRequest.update(request.id, {
          status: 'aprobada',
          approved_by: 'system',
          approved_date: new Date().toISOString()
        });

        const notificationMessage = `Tu solicitud pasó automáticamente a aprobaciones porque ya venció el período de espera.\n\nPaquetes listos: ${receivedPackages.length}\n\nEl equipo ahora debe consolidar físicamente la carga, registrar dimensiones, fecha de envío y generar la factura antes del tránsito.`;

        await base44.asServiceRole.entities.Notification.create({
          user_email: request.client_email,
          title: '📦 Solicitud lista para consolidación',
          message: notificationMessage,
          type: 'request',
          priority: 'high',
          reference_id: request.id,
          entity_type: 'ConsolidationRequest',
          icon: 'package'
        });

        try {
          await sendBrevoEmail(base44, {
            to: request.client_email,
            subject: '📦 Tu solicitud pasó a aprobaciones',
            body: `
              <h2>Tu solicitud está lista para consolidación</h2>
              <p>Hola,</p>
              <p>Tu solicitud pasó automáticamente a la bandeja de aprobaciones porque venció el período de espera.</p>
              <p>Ahora el equipo debe consolidar físicamente la carga, registrar dimensiones y generar la factura antes de poner el envío en tránsito.</p>
            `
          });
        } catch (emailError) {
          console.error('Error sending email:', emailError);
        }

        const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
        for (const admin of admins) {
          await base44.asServiceRole.entities.Notification.create({
            user_email: admin.email,
            title: '📦 Solicitud auto-aprobada por vencimiento',
            message: `${receivedPackages.length} paquete(s) de ${request.client_email} quedaron listos para consolidación física y factura.`,
            type: 'request',
            priority: 'medium',
            reference_id: request.id,
            entity_type: 'ConsolidationRequest',
            icon: 'package'
          });
        }

        results.push({
          clientEmail: request.client_email,
          packagesReady: receivedPackages.length,
          requestId: request.id,
          action: 'approved'
        });
      }
    }

    return Response.json({
      success: true,
      requestsApproved: results.length,
      details: results
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});