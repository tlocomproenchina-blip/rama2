import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only admin can trigger this
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get all consolidation requests that are pending
    const pendingRequests = await base44.asServiceRole.entities.ConsolidationRequest.filter({
      status: 'pendiente'
    });

    const config = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' });
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
        // Create consolidation
        const consolidationTracking = `CONS-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        
        const consolidation = await base44.asServiceRole.entities.Consolidation.create({
          consolidation_tracking: consolidationTracking,
          client_email: request.client_email,
          shipping_mark: request.shipping_mark,
          package_ids: receivedPackages.map(p => p.id),
          tracking_numbers: receivedPackages.map(p => p.tracking_number),
          shipping_type: request.shipping_type,
          status: 'en_transito',
          consolidation_period_days: defaultPeriodDays,
          consolidation_request_id: request.id,
          created_date: new Date().toISOString()
        });

        // Update request status to consolidada
        await base44.asServiceRole.entities.ConsolidationRequest.update(request.id, {
          status: 'consolidada',
          consolidation_id: consolidation.id
        });

        // Update packages status to consolidado
        for (const pkg of receivedPackages) {
          await base44.asServiceRole.entities.Package.update(pkg.id, {
            status: 'consolidado',
            consolidation_id: consolidation.id
          });
        }

        // Create notification for client
        await base44.asServiceRole.entities.Notification.create({
          user_email: request.client_email,
          title: '📦 Consolidación Automática Completada',
          message: `Se ha consolidado automáticamente ${receivedPackages.length} paquete(s) con tracking ${consolidationTracking}`,
          type: 'consolidation',
          priority: 'high',
          reference_id: consolidation.id,
          entity_type: 'Consolidation',
          icon: 'truck'
        });

        // Create notification for admins
        const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
        for (const admin of admins) {
          await base44.asServiceRole.entities.Notification.create({
            user_email: admin.email,
            title: '📦 Consolidación Automática Creada',
            message: `${receivedPackages.length} paquete(s) de ${request.client_email} consolidados automáticamente: ${consolidationTracking}`,
            type: 'consolidation',
            priority: 'medium',
            reference_id: consolidation.id,
            entity_type: 'Consolidation',
            icon: 'truck'
          });
        }

        results.push({
          clientEmail: request.client_email,
          packagesConsolidated: receivedPackages.length,
          consolidationId: consolidation.id,
          consolidationTracking: consolidationTracking
        });
      }
    }

    return Response.json({
      success: true,
      consolidationsCreated: results.length,
      details: results
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});