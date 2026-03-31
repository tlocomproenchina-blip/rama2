import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const ACTIVE_ROUTE_STATES = ['asignada', 'en_curso'];

function getSeverity(summary) {
  if ((summary.resource_conflicts || 0) > 0 || (summary.duplicate_packages || 0) > 0) {
    return 'critical';
  }
  if ((summary.capacity_alerts || 0) > 0) {
    return 'warning';
  }
  return 'healthy';
}

function getSummaryText(summary) {
  return `Rutas activas: ${summary.active_routes || 0} · Cargas: ${summary.total_loads || 0} · Conflictos: ${summary.resource_conflicts || 0} · Duplicados: ${summary.duplicate_packages || 0} · Sobrecarga: ${summary.capacity_alerts || 0}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

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
      if (route.vehiculo_id) vehicleBuckets[route.vehiculo_id] = [...(vehicleBuckets[route.vehiculo_id] || []), route];
      if (route.chofer_id) driverBuckets[route.chofer_id] = [...(driverBuckets[route.chofer_id] || []), route];
    }

    const resourceConflicts = [
      ...Object.entries(vehicleBuckets).filter(([, assignedRoutes]) => assignedRoutes.length > 1),
      ...Object.entries(driverBuckets).filter(([, assignedRoutes]) => assignedRoutes.length > 1),
    ];

    const packageBuckets = {};
    for (const load of loads || []) {
      if (!load.package_id) continue;
      packageBuckets[load.package_id] = [...(packageBuckets[load.package_id] || []), load];
    }
    const duplicatePackages = Object.entries(packageBuckets).filter(([, assignedLoads]) => assignedLoads.length > 1);

    const loadTotalsByRoute = (loads || []).reduce((acc, load) => {
      const current = acc[load.ruta_id] || { totalWeightKg: 0, totalVolumeM3: 0 };
      acc[load.ruta_id] = {
        totalWeightKg: current.totalWeightKg + Number(load.peso_kg || 0),
        totalVolumeM3: current.totalVolumeM3 + Number(load.volumen_m3 || 0),
      };
      return acc;
    }, {});

    const capacityAlerts = activeRoutes.filter((route) => {
      if (!route.vehiculo_id) return false;
      const vehicle = vehiclesById[route.vehiculo_id];
      if (!vehicle) return false;
      const totals = loadTotalsByRoute[route.id] || { totalWeightKg: 0, totalVolumeM3: 0 };
      const isOverWeight = Number(vehicle.capacidad_peso_kg || 0) > 0 && totals.totalWeightKg > Number(vehicle.capacidad_peso_kg || 0);
      const isOverVolume = Number(vehicle.capacidad_volumen_m3 || 0) > 0 && totals.totalVolumeM3 > Number(vehicle.capacidad_volumen_m3 || 0);
      return isOverWeight || isOverVolume;
    });

    const summary = {
      active_routes: activeRoutes.length,
      total_loads: (loads || []).length,
      resource_conflicts: resourceConflicts.length,
      duplicate_packages: duplicatePackages.length,
      capacity_alerts: capacityAlerts.length,
    };

    const report = await base44.asServiceRole.entities.LogisticsHealthReport.create({
      checked_at: new Date().toISOString(),
      active_routes: Number(summary.active_routes || 0),
      total_loads: Number(summary.total_loads || 0),
      resource_conflicts: Number(summary.resource_conflicts || 0),
      duplicate_packages: Number(summary.duplicate_packages || 0),
      capacity_alerts: Number(summary.capacity_alerts || 0),
      severity: getSeverity(summary),
      summary_text: getSummaryText(summary),
    });

    return Response.json({ ok: true, report, summary });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});