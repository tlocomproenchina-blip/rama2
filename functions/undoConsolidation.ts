import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { consolidation_tracking } = await req.json();

    if (!consolidation_tracking) {
      return Response.json({ error: 'consolidation_tracking es requerido' }, { status: 400 });
    }

    // Buscar la consolidación
    const consolidations = await base44.asServiceRole.entities.Consolidation.filter({ 
      consolidation_tracking 
    });

    if (consolidations.length === 0) {
      return Response.json({ error: 'Consolidación no encontrada' }, { status: 404 });
    }

    const consolidation = consolidations[0];

    // Actualizar los paquetes de vuelta a 'recibido'
    for (const pkgId of consolidation.package_ids || []) {
      await base44.asServiceRole.entities.Package.update(pkgId, {
        status: 'recibido',
        consolidation_id: null
      });
    }

    // Actualizar la solicitud de vuelta a 'aprobada'
    if (consolidation.consolidation_request_id) {
      await base44.asServiceRole.entities.ConsolidationRequest.update(
        consolidation.consolidation_request_id,
        {
          status: 'aprobada',
          consolidation_id: null
        }
      );
    }

    // Eliminar la factura asociada
    const invoices = await base44.asServiceRole.entities.Invoice.filter({ 
      consolidation_id: consolidation.id 
    });
    for (const invoice of invoices) {
      await base44.asServiceRole.entities.Invoice.delete(invoice.id);
    }

    // Eliminar la consolidación
    await base44.asServiceRole.entities.Consolidation.delete(consolidation.id);

    return Response.json({ 
      success: true,
      message: 'Consolidación deshecha exitosamente',
      packages_restored: consolidation.package_ids?.length || 0
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});