import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

async function hasWarehouseAccess(base44, user, allowedPages) {
  if (user?.role === 'admin') return true;
  if (['warehouse', 'operations_manager', 'almacen'].includes(user?.custom_role)) return true;
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
    if (!(await hasWarehouseAccess(base44, user, ['WarehouseDashboard']))) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [warehouses, locations, preAlertPackages, approvedRequestsList] = await Promise.all([
      base44.asServiceRole.entities.Warehouse.list('name', 200),
      base44.asServiceRole.entities.WarehouseLocation.list('code', 1000),
      base44.asServiceRole.entities.Package.filter({ status: 'pre_alerta' }, '-updated_date', 300),
      base44.asServiceRole.entities.ConsolidationRequest.filter({ status: 'aprobada' }, '-updated_date', 300),
    ]);

    const activeWarehouses = (warehouses || []).filter((warehouse) => warehouse.is_active !== false);
    const activeLocations = (locations || []).filter((location) => location.is_active !== false);

    let occupiedLocations = 0;
    let totalCapacityUnits = 0;
    let totalCurrentUnits = 0;
    let totalCapacityWeight = 0;
    let totalCurrentWeight = 0;
    let totalCapacityVolume = 0;
    let totalCurrentVolume = 0;

    const zoneMap = new Map();
    const warehouseMap = new Map();

    activeWarehouses.forEach((warehouse) => {
      warehouseMap.set(warehouse.id, {
        id: warehouse.id,
        name: warehouse.name,
        city: warehouse.city,
        country: warehouse.country,
        locations: 0,
        occupied_locations: 0,
        packages: 0,
      });
    });

    for (const location of activeLocations) {
      const currentUnits = Number(location.current_units || 0);
      const currentWeight = Number(location.current_weight_kg || 0);
      const currentVolume = Number(location.current_volume_cbm || 0);
      const capacityUnits = Number(location.capacity_units || 0);
      const capacityWeight = Number(location.capacity_weight_kg || 0);
      const capacityVolume = Number(location.capacity_volume_cbm || 0);
      const zoneKey = location.zone || 'sin_zona';

      if (currentUnits > 0) occupiedLocations += 1;

      totalCapacityUnits += capacityUnits;
      totalCurrentUnits += currentUnits;
      totalCapacityWeight += capacityWeight;
      totalCurrentWeight += currentWeight;
      totalCapacityVolume += capacityVolume;
      totalCurrentVolume += currentVolume;

      const zoneCurrent = zoneMap.get(zoneKey) || {
        zone: zoneKey,
        locations: 0,
        occupied_locations: 0,
        packages: 0,
      };
      zoneCurrent.locations += 1;
      zoneCurrent.packages += currentUnits;
      if (currentUnits > 0) zoneCurrent.occupied_locations += 1;
      zoneMap.set(zoneKey, zoneCurrent);

      if (location.warehouse_id && warehouseMap.has(location.warehouse_id)) {
        const warehouseCurrent = warehouseMap.get(location.warehouse_id);
        warehouseCurrent.locations += 1;
        warehouseCurrent.packages += currentUnits;
        if (currentUnits > 0) warehouseCurrent.occupied_locations += 1;
      }
    }

    return Response.json({
      success: true,
      stats: {
        total_warehouses: (warehouses || []).length,
        active_warehouses: activeWarehouses.length,
        total_locations: (locations || []).length,
        active_locations: activeLocations.length,
        occupied_locations: occupiedLocations,
        assigned_packages: totalCurrentUnits,
        pending_reception: (preAlertPackages || []).length,
        approved_requests: (approvedRequestsList || []).length,
        capacity: {
          units: {
            current: totalCurrentUnits,
            total: totalCapacityUnits,
            utilization_percent: percent(totalCurrentUnits, totalCapacityUnits),
          },
          weight: {
            current: Number(totalCurrentWeight.toFixed(3)),
            total: Number(totalCapacityWeight.toFixed(3)),
            utilization_percent: percent(totalCurrentWeight, totalCapacityWeight),
          },
          volume: {
            current: Number(totalCurrentVolume.toFixed(6)),
            total: Number(totalCapacityVolume.toFixed(6)),
            utilization_percent: percent(totalCurrentVolume, totalCapacityVolume),
          },
        },
        warehouses: Array.from(warehouseMap.values()).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
        zones: Array.from(zoneMap.values()).sort((a, b) => String(a.zone || '').localeCompare(String(b.zone || ''))),
      },
    });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});