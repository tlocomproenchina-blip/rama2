import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const payload = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const routeId = String(payload.routeId || '');
    const vehicleId = String(payload.vehicleId || '');
    const driverId = String(payload.driverId || '');
    const routeStatus = String(payload.routeStatus || 'planificada');
    const activeStates = ['asignada', 'en_curso'];

    if (!activeStates.includes(routeStatus)) {
      return Response.json({ valid: true, vehicleConflict: null, driverConflict: null });
    }

    const routes = await base44.asServiceRole.entities.Ruta.list('-updated_date', 500);
    const activeRoutes = routes.filter((route) => route.id !== routeId && activeStates.includes(route.estado));

    const vehicleConflict = vehicleId
      ? activeRoutes.find((route) => route.vehiculo_id === vehicleId)
      : null;

    const driverConflict = driverId
      ? activeRoutes.find((route) => route.chofer_id === driverId)
      : null;

    return Response.json({
      valid: !vehicleConflict && !driverConflict,
      vehicleConflict: vehicleConflict
        ? {
            id: vehicleConflict.id,
            codigo_ruta: vehicleConflict.codigo_ruta,
            estado: vehicleConflict.estado,
          }
        : null,
      driverConflict: driverConflict
        ? {
            id: driverConflict.id,
            codigo_ruta: driverConflict.codigo_ruta,
            estado: driverConflict.estado,
          }
        : null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});