import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const payload = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const loadId = String(payload.loadId || '');
    const routeId = String(payload.routeId || '');
    const packageId = String(payload.packageId || '');
    const loadType = String(payload.loadType || 'paquete');
    const weightKg = Number(payload.weightKg || 0);
    const volumeM3 = Number(payload.volumeM3 || 0);

    const duplicateCandidates = loadType === 'paquete' && packageId
      ? await base44.asServiceRole.entities.CargaRuta.filter({ package_id: packageId }, '-updated_date', 50)
      : [];

    const duplicatePackageConflict = duplicateCandidates.find((item) => item.id !== loadId) || null;

    const routeRows = routeId
      ? await base44.asServiceRole.entities.Ruta.filter({ id: routeId }, '-updated_date', 1)
      : [];
    const route = routeRows?.[0] || null;

    const routeLoads = routeId
      ? await base44.asServiceRole.entities.CargaRuta.filter({ ruta_id: routeId }, '-updated_date', 500)
      : [];

    const totals = routeLoads.reduce((acc, item) => {
      if (item.id === loadId) return acc;
      acc.totalWeightKg += Number(item.peso_kg || 0);
      acc.totalVolumeM3 += Number(item.volumen_m3 || 0);
      return acc;
    }, {
      totalWeightKg: weightKg,
      totalVolumeM3: volumeM3,
    });

    let capacityWarning = null;

    if (route?.vehiculo_id) {
      const vehicleRows = await base44.asServiceRole.entities.Vehiculo.filter({ id: route.vehiculo_id }, '-updated_date', 1);
      const vehicle = vehicleRows?.[0] || null;

      if (vehicle) {
        const maxWeightKg = Number(vehicle.capacidad_peso_kg || 0);
        const maxVolumeM3 = Number(vehicle.capacidad_volumen_m3 || 0);
        const isOverWeight = maxWeightKg > 0 && totals.totalWeightKg > maxWeightKg;
        const isOverVolume = maxVolumeM3 > 0 && totals.totalVolumeM3 > maxVolumeM3;

        capacityWarning = {
          isOverCapacity: isOverWeight || isOverVolume,
          isOverWeight,
          isOverVolume,
          totalWeightKg: totals.totalWeightKg,
          totalVolumeM3: totals.totalVolumeM3,
          maxWeightKg,
          maxVolumeM3,
          vehiclePlate: vehicle.placa || '',
        };
      }
    }

    return Response.json({
      valid: !duplicatePackageConflict && !capacityWarning?.isOverCapacity,
      duplicatePackageConflict: duplicatePackageConflict
        ? {
            id: duplicatePackageConflict.id,
            ruta_id: duplicatePackageConflict.ruta_id,
            tracking_number: duplicatePackageConflict.tracking_number,
          }
        : null,
      capacityWarning,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});