import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { package_id, action, updates } = await req.json();
    if (!package_id) return Response.json({ error: 'package_id requerido' }, { status: 400 });

    const pkg = await base44.asServiceRole.entities.Package.get(package_id);
    if (!pkg) return Response.json({ error: 'Paquete no encontrado' }, { status: 404 });

    // Solo el dueño del paquete (o un admin) puede modificarlo
    if (user.role !== 'admin' && pkg.client_email !== user.email) {
      return Response.json({ error: 'No autorizado para este paquete' }, { status: 403 });
    }

    if (action === 'delete') {
      if (user.role !== 'admin' && ['recibido', 'entregado'].includes(pkg.status)) {
        return Response.json({ error: 'El paquete ya fue recibido/entregado y no puede eliminarse' }, { status: 403 });
      }
      if (pkg.status !== 'pre_alerta') {
        return Response.json({ error: 'Solo se pueden eliminar pre-alertas' }, { status: 403 });
      }
      await base44.asServiceRole.entities.Package.delete(package_id);
      return Response.json({ success: true });
    }

    // Campos permitidos para el cliente
    const allowedFields = ['tracking_number', 'description', 'shipping_type', 'seller_delivery_date', 'has_insurance', 'fob_value', 'invoice_url'];
    const safeUpdates = {};
    for (const key of allowedFields) {
      if (updates && Object.prototype.hasOwnProperty.call(updates, key)) {
        safeUpdates[key] = updates[key];
      }
    }
    if (Object.keys(safeUpdates).length === 0) {
      return Response.json({ error: 'Sin cambios válidos' }, { status: 400 });
    }

    // Edición completa solo en pre-alerta; la fecha del vendedor y los datos de seguro se permiten siempre
    const flexibleFields = ['seller_delivery_date', 'has_insurance', 'fob_value', 'invoice_url'];
    const onlyFlexible = Object.keys(safeUpdates).every((k) => flexibleFields.includes(k));
    if (!onlyFlexible && pkg.status !== 'pre_alerta' && user.role !== 'admin') {
      return Response.json({ error: 'Solo se pueden editar pre-alertas' }, { status: 403 });
    }

    await base44.asServiceRole.entities.Package.update(package_id, safeUpdates);
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});