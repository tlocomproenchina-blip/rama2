import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const ACTIVE_ROUTE_STATES = ['asignada', 'en_curso'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const [routes, vehicles, loads] = await Promise.all([
      base44.asServiceRole.entities.Ruta.list('-updated_date', 500),
      base44.asServiceRole.entities.Vehiculo.list('-updated_date', 500),
      base44.asServiceRole.entities.CargaRuta.list('-updated_date', 1000),
    ]);

    const activeRoutes = (routes || []).filter((route) => ACTIVE_ROUTE_STATES.includes(route.estado));
    const vehiclesById = Object.fromEntries((vehicles || []).map((item) => [item.id, item]));

    const vehicleBuckets = {};
    const driverBuckets = {};

    for (const route of activeRoutes) {
      if (route.vehiculo_id) {
        vehicleBuckets[route.vehiculo_id] = [...(vehicleBuckets[route.vehiculo_id] || []), route];
      }
      if (route.chofer_id) {
        driverBuckets[route.chofer_id] = [...(driverBuckets[route.chofer_id] || []), route];
      }
    }

    const resourceConflicts = [
      ...Object.entries(vehicleBuckets)
        .filter(([, assignedRoutes]) => assignedRoutes.length > 1)
        .map(([resourceId, assignedRoutes]) => ({
          resource_type: 'vehiculo',
          resource_id: resourceId,
          resource_label: assignedRoutes[0]?.vehiculo_placa || '',
          routes: assignedRoutes.map((route) => ({ id: route.id, codigo_ruta: route.codigo_ruta, estado: route.estado })),
        })),
      ...Object.entries(driverBuckets)
        .filter(([, assignedRoutes]) => assignedRoutes.length > 1)
        .map(([resourceId, assignedRoutes]) => ({
          resource_type: 'chofer',
          resource_id: resourceId,
          resource_label: assignedRoutes[0]?.chofer_nombre || '',
          routes: assignedRoutes.map((route) => ({ id: route.id, codigo_ruta: route.codigo_ruta, estado: route.estado })),
        })),
    ];

    const packageBuckets = {};
    for (const load of loads || []) {
      if (!load.package_id) continue;
      packageBuckets[load.package_id] = [...(packageBuckets[load.package_id] || []), load];
    }

    const duplicatePackages = Object.entries(packageBuckets)
      .filter(([, assignedLoads]) => assignedLoads.length > 1)
      .map(([packageId, assignedLoads]) => ({
        package_id: packageId,
        tracking_numbers: assignedLoads.map((load) => load.tracking_number).filter(Boolean),
        routes: assignedLoads.map((load) => ({ id: load.ruta_id, tracking_number: load.tracking_number })),
      }));

    const loadTotalsByRoute = (loads || []).reduce((acc, load) => {
      const current = acc[load.ruta_id] || { totalWeightKg: 0, totalVolumeM3: 0 };
      acc[load.ruta_id] = {
        totalWeightKg: current.totalWeightKg + Number(load.peso_kg || 0),
        totalVolumeM3: current.totalVolumeM3 + Number(load.volumen_m3 || 0),
      };
      return acc;
    }, {});

    const capacityAlerts = activeRoutes.reduce((acc, route) => {
      if (!route.vehiculo_id) return acc;
      const vehicle = vehiclesById[route.vehiculo_id];
      if (!vehicle) return acc;

      const totals = loadTotalsByRoute[route.id] || { totalWeightKg: 0, totalVolumeM3: 0 };
      const maxWeightKg = Number(vehicle.capacidad_peso_kg || 0);
      const maxVolumeM3 = Number(vehicle.capacidad_volumen_m3 || 0);
      const isOverWeight = maxWeightKg > 0 && totals.totalWeightKg > maxWeightKg;
      const isOverVolume = maxVolumeM3 > 0 && totals.totalVolumeM3 > maxVolumeM3;

      if (!isOverWeight && !isOverVolume) return acc;

      acc.push({
        route_id: route.id,
        codigo_ruta: route.codigo_ruta,
        vehicle_plate: vehicle.placa || '',
        totalWeightKg: totals.totalWeightKg,
        totalVolumeM3: totals.totalVolumeM3,
        maxWeightKg,
        maxVolumeM3,
        isOverWeight,
        isOverVolume,
      });
      return acc;
    }, []);

    return Response.json({
      ok: true,
      checked_at: new Date().toISOString(),
      summary: {
        active_routes: activeRoutes.length,
        total_loads: (loads || []).length,
        resource_conflicts: resourceConflicts.length,
        duplicate_packages: duplicatePackages.length,
        capacity_alerts: capacityAlerts.length,
      },
      resourceConflicts,
      duplicatePackages,
      capacityAlerts,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});