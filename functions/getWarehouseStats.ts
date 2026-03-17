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

function percent(current, capacity) {
  if (!capacity || capacity <= 0) return 0;
  return Number(((current / capacity) * 100).toFixed(1));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await hasWarehouseAccess(base44, user, ['WarehouseDashboard']))) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const [locations, packages, requests] = await Promise.all([
      base44.asServiceRole.entities.WarehouseLocation.list('code', 500),
      base44.asServiceRole.entities.Package.list('-updated_date', 1000),
      base44.asServiceRole.entities.ConsolidationRequest.list('-updated_date', 300)
    ]);

    const activeLocations = (locations || []).filter((l) => l.is_active !== false);
    const assignedPackages = (packages || []).filter((p) => p.warehouse_location_id);
    const occupiedLocations = activeLocations.filter((location) => Number(location.current_units || 0) > 0).length;

    const totalCapacityUnits = activeLocations.reduce((sum, location) => sum + Number(location.capacity_units || 0), 0);
    const totalCurrentUnits = activeLocations.reduce((sum, location) => sum + Number(location.current_units || 0), 0);
    const totalCapacityWeight = activeLocations.reduce((sum, location) => sum + Number(location.capacity_weight_kg || 0), 0);
    const totalCurrentWeight = activeLocations.reduce((sum, location) => sum + Number(location.current_weight_kg || 0), 0);
    const totalCapacityVolume = activeLocations.reduce((sum, location) => sum + Number(location.capacity_volume_cbm || 0), 0);
    const totalCurrentVolume = activeLocations.reduce((sum, location) => sum + Number(location.current_volume_cbm || 0), 0);

    const zoneMap = new Map();
    activeLocations.forEach((location) => {
      zoneMap.set(location.zone, {
        zone: location.zone,
        locations: 0,
        occupied_locations: 0,
        packages: 0,
      });
    });

    activeLocations.forEach((location) => {
      const current = zoneMap.get(location.zone) || { zone: location.zone, locations: 0, occupied_locations: 0, packages: 0 };
      current.locations += 1;
      if (Number(location.current_units || 0) > 0) current.occupied_locations += 1;
      zoneMap.set(location.zone, current);
    });

    assignedPackages.forEach((pkg) => {
      const zone = pkg.warehouse_zone || 'sin_ubicar';
      const current = zoneMap.get(zone) || { zone, locations: 0, occupied_locations: 0, packages: 0 };
      current.packages += 1;
      zoneMap.set(zone, current);
    });

    const approvedRequests = (requests || []).filter((request) => request.status === 'aprobada').length;

    return Response.json({
      success: true,
      stats: {
        total_locations: locations.length,
        active_locations: activeLocations.length,
        occupied_locations: occupiedLocations,
        assigned_packages: assignedPackages.length,
        pending_reception: (packages || []).filter((pkg) => pkg.status === 'pre_alerta').length,
        approved_requests: approvedRequests,
        capacity: {
          units: {
            current: totalCurrentUnits,
            total: totalCapacityUnits,
            utilization_percent: percent(totalCurrentUnits, totalCapacityUnits)
          },
          weight: {
            current: Number(totalCurrentWeight.toFixed(3)),
            total: Number(totalCapacityWeight.toFixed(3)),
            utilization_percent: percent(totalCurrentWeight, totalCapacityWeight)
          },
          volume: {
            current: Number(totalCurrentVolume.toFixed(6)),
            total: Number(totalCapacityVolume.toFixed(6)),
            utilization_percent: percent(totalCurrentVolume, totalCapacityVolume)
          }
        },
        zones: Array.from(zoneMap.values()).sort((a, b) => a.zone.localeCompare(b.zone))
      }
    });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});