import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function hasWarehouseAccess(user) {
  return user?.role === 'admin' || ['warehouse', 'operations_manager'].includes(user?.custom_role);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasWarehouseAccess(user)) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const locationId = String(body?.location_id || '').trim();
    if (!locationId) {
      return Response.json({ error: 'location_id es obligatorio' }, { status: 400 });
    }

    const assignedPackages = await base44.asServiceRole.entities.Package.filter({ warehouse_location_id: locationId }, '-updated_date', 1);
    if (assignedPackages?.length) {
      return Response.json({ error: 'No se puede eliminar una ubicación con paquetes asignados' }, { status: 409 });
    }

    await base44.asServiceRole.entities.WarehouseLocation.delete(locationId);
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});