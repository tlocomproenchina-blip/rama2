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

function remaining(capacity, current) {
  if (capacity === null || capacity === undefined || capacity === '') return Number.MAX_SAFE_INTEGER;
  return Number(capacity || 0) - Number(current || 0);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await hasWarehouseAccess(base44, user, ['WarehouseReceive', 'WarehouseLocations', 'WarehousePickPackShip']))) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const zone = body?.zone ? String(body.zone).trim() : null;
    const warehouseId = body?.warehouse_id ? String(body.warehouse_id).trim() : null;
    const minUnits = Number(body?.min_units ?? 1);
    const minVolume = Number(body?.min_volume_cbm ?? 0);
    const minWeight = Number(body?.min_weight_kg ?? 0);

    const query = { is_active: true };
    if (zone) query.zone = zone;
    if (warehouseId) query.warehouse_id = warehouseId;
    const locations = await base44.asServiceRole.entities.WarehouseLocation.filter(query, 'code', 200);

    // Conteo autoritativo en tiempo real: consultar paquetes activos (recibido/disponible)
    // agrupados por ubicación, en lugar de confiar en current_units (que puede estar stale
    // por asignaciones offline de otros dispositivos).
    const activeStatuses = ['recibido', 'disponible'];
    let realTimeCounts = {};
    try {
      const pkgQuery = warehouseId ? { warehouse_id: warehouseId } : {};
      const allActivePkgs = await base44.asServiceRole.entities.Package.filter(pkgQuery, '-updated_date', 2000);
      for (const p of (allActivePkgs || [])) {
        if (!p.warehouse_location_id || !activeStatuses.includes(p.status)) continue;
        realTimeCounts[p.warehouse_location_id] = (realTimeCounts[p.warehouse_location_id] || 0) + 1;
      }
    } catch (_) {
      // Fallback al current_units cacheado si la query falla
      for (const loc of (locations || [])) {
        realTimeCounts[loc.id] = Number(loc.current_units || 0);
      }
    }

    const matches = (locations || []).filter((location) => {
      const realUnits = realTimeCounts[location.id] || 0;
      const unitsLeft = remaining(location.capacity_units, realUnits);
      const volumeLeft = remaining(location.capacity_volume_cbm, location.current_volume_cbm);
      const weightLeft = remaining(location.capacity_weight_kg, location.current_weight_kg);
      return unitsLeft >= minUnits && volumeLeft >= minVolume && weightLeft >= minWeight;
    }).sort((a, b) => {
      const aReal = realTimeCounts[a.id] || 0;
      const bReal = realTimeCounts[b.id] || 0;
      const aScore = remaining(a.capacity_units, aReal) + remaining(a.capacity_volume_cbm, a.current_volume_cbm) + remaining(a.capacity_weight_kg, a.current_weight_kg);
      const bScore = remaining(b.capacity_units, bReal) + remaining(b.capacity_volume_cbm, b.current_volume_cbm) + remaining(b.capacity_weight_kg, b.current_weight_kg);
      return aScore - bScore;
    });

    return Response.json({ success: true, best_match: matches[0] || null, matches });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});