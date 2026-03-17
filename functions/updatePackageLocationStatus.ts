import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

async function hasWarehouseAccess(base44, user, allowedPages) {
  if (user?.role === 'admin') return true;
  if (['warehouse', 'operations_manager'].includes(user?.custom_role)) return true;
  if (!user?.custom_role) return false;
  const roles = await base44.asServiceRole.entities.RoleConfig.filter({ role_code: user.custom_role, is_active: true }, '-updated_date', 1);
  const role = roles?.[0];
  const visiblePages = role?.visible_pages || [];
  return allowedPages.some((page) => visiblePages.includes(page));
}

async function recalcLocation(base44, locationId) {
  if (!locationId) return null;
  const packages = await base44.asServiceRole.entities.Package.filter({ warehouse_location_id: locationId }, '-updated_date', 500);
  return await base44.asServiceRole.entities.WarehouseLocation.update(locationId, {
    current_units: packages.length,
    current_weight_kg: Number(packages.reduce((sum, pkg) => sum + Number(pkg.actual_weight_kg || 0), 0).toFixed(3)),
    current_volume_cbm: Number(packages.reduce((sum, pkg) => sum + Number(pkg.actual_cbm || 0), 0).toFixed(6))
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await hasWarehouseAccess(base44, user, ['WarehousePickPackShip', 'WarehouseLocations']))) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const packageId = String(body?.package_id || '').trim();
    const targetLocationId = String(body?.target_location_id || '').trim();
    if (!packageId || !targetLocationId) {
      return Response.json({ error: 'package_id y target_location_id son obligatorios' }, { status: 400 });
    }

    const pkg = await base44.asServiceRole.entities.Package.get(packageId);
    const location = await base44.asServiceRole.entities.WarehouseLocation.get(targetLocationId);
    if (!pkg) return Response.json({ error: 'Paquete no encontrado' }, { status: 404 });
    if (!location || location.is_active === false) return Response.json({ error: 'Ubicación destino no válida' }, { status: 404 });

    const noteLine = `Movimiento interno a ${location.code} por ${user.email} el ${new Date().toISOString()}${body?.movement_note ? ` — ${String(body.movement_note).trim()}` : ''}`;
    const notes = pkg.reception_notes ? `${pkg.reception_notes}\n${noteLine}` : noteLine;

    const updatedPackage = await base44.asServiceRole.entities.Package.update(packageId, {
      warehouse_location_id: location.id,
      warehouse_location_code: location.code,
      warehouse_location_name: location.name,
      warehouse_zone: location.zone,
      reception_notes: notes
    });

    await recalcLocation(base44, location.id);
    if (pkg.warehouse_location_id && pkg.warehouse_location_id !== location.id) {
      await recalcLocation(base44, pkg.warehouse_location_id);
    }

    return Response.json({ success: true, package: updatedPackage, location });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});