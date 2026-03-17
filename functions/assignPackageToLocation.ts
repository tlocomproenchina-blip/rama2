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

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function computeCbm(lengthCm, widthCm, heightCm) {
  if (!lengthCm || !widthCm || !heightCm) return null;
  return Number(((lengthCm * widthCm * heightCm) / 1000000).toFixed(6));
}

async function recalcLocation(base44, locationId) {
  if (!locationId) return null;
  const packages = await base44.asServiceRole.entities.Package.filter({ warehouse_location_id: locationId }, '-updated_date', 500);
  const current_units = packages.length;
  const current_weight_kg = Number(packages.reduce((sum, pkg) => sum + Number(pkg.actual_weight_kg || 0), 0).toFixed(3));
  const current_volume_cbm = Number(packages.reduce((sum, pkg) => sum + Number(pkg.actual_cbm || 0), 0).toFixed(6));
  return await base44.asServiceRole.entities.WarehouseLocation.update(locationId, {
    current_units,
    current_weight_kg,
    current_volume_cbm
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await hasWarehouseAccess(base44, user, ['WarehouseReceive', 'WarehouseLocations']))) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const packageId = String(body?.package_id || '').trim();
    const locationId = String(body?.location_id || '').trim();

    if (!packageId || !locationId) {
      return Response.json({ error: 'package_id y location_id son obligatorios' }, { status: 400 });
    }

    const pkg = await base44.asServiceRole.entities.Package.get(packageId);
    if (!pkg) return Response.json({ error: 'Paquete no encontrado' }, { status: 404 });

    const location = await base44.asServiceRole.entities.WarehouseLocation.get(locationId);
    if (!location || location.is_active === false) {
      return Response.json({ error: 'Ubicación no encontrada o inactiva' }, { status: 404 });
    }

    const actual_length_cm = toNumber(body?.actual_length_cm) ?? toNumber(pkg.actual_length_cm);
    const actual_width_cm = toNumber(body?.actual_width_cm) ?? toNumber(pkg.actual_width_cm);
    const actual_height_cm = toNumber(body?.actual_height_cm) ?? toNumber(pkg.actual_height_cm);
    const actual_weight_kg = toNumber(body?.actual_weight_kg) ?? toNumber(pkg.actual_weight_kg);
    const actual_cbm = toNumber(body?.actual_cbm) ?? computeCbm(actual_length_cm, actual_width_cm, actual_height_cm) ?? toNumber(pkg.actual_cbm);

    const updatedPackage = await base44.asServiceRole.entities.Package.update(packageId, {
      warehouse_location_id: location.id,
      warehouse_location_code: location.code,
      warehouse_location_name: location.name,
      warehouse_zone: location.zone,
      actual_length_cm,
      actual_width_cm,
      actual_height_cm,
      actual_weight_kg,
      actual_cbm,
      reception_notes: body?.reception_notes ?? pkg.reception_notes,
      received_by: body?.mark_received === true ? user.email : pkg.received_by,
      received_date: body?.mark_received === true ? new Date().toISOString() : pkg.received_date,
      status: body?.mark_received === true && pkg.status === 'pre_alerta' ? 'recibido' : pkg.status
    });

    const refreshedLocation = await recalcLocation(base44, location.id);
    if (pkg.warehouse_location_id && pkg.warehouse_location_id !== location.id) {
      await recalcLocation(base44, pkg.warehouse_location_id);
    }

    return Response.json({ success: true, package: updatedPackage, location: refreshedLocation });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});