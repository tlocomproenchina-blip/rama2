import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const ACTIVE_ROUTE_STATES = ['asignada', 'en_curso'];
const ROUTE_STATUS_MAP = {
  salida: 'asignada',
  en_transito: 'en_curso',
  detenido: 'en_curso',
  entrega_parcial: 'en_curso',
  entregada: 'completada',
  incidencia: 'en_curso',
};
const LOAD_STATUS_MAP = {
  en_transito: 'en_transito',
  entrega_parcial: 'entrega_parcial',
  entregada: 'entregada',
  incidencia: 'incidencia',
};
const PACKAGE_STATUS_MAP = {
  en_transito: 'en_transito',
  entrega_parcial: 'en_transito',
  entregada: 'entregado',
};

async function getEntityRecord(base44, entityName, id) {
  if (!id) return null;
  const rows = await base44.asServiceRole.entities[entityName].filter({ id }, '-updated_date', 1);
  return rows?.[0] || null;
}

async function syncVehicle(base44, vehicleId) {
  if (!vehicleId) return;
  const routes = await base44.asServiceRole.entities.Ruta.filter({ vehiculo_id: vehicleId }, '-updated_date', 100);
  const activeRoute = (routes || []).find((route) => ACTIVE_ROUTE_STATES.includes(route.estado));

  if (activeRoute) {
    await base44.asServiceRole.entities.Vehiculo.update(vehicleId, {
      estado: 'en_ruta',
      chofer_id: activeRoute.chofer_id || '',
      chofer_nombre: activeRoute.chofer_nombre || '',
    });
    return;
  }

  await base44.asServiceRole.entities.Vehiculo.update(vehicleId, {
    estado: 'disponible',
    chofer_id: '',
    chofer_nombre: '',
  });
}

async function syncDriver(base44, driverId) {
  if (!driverId) return;
  const routes = await base44.asServiceRole.entities.Ruta.filter({ chofer_id: driverId }, '-updated_date', 100);
  const activeRoute = (routes || []).find((route) => ACTIVE_ROUTE_STATES.includes(route.estado));

  await base44.asServiceRole.entities.Chofer.update(driverId, {
    estado: activeRoute ? 'en_ruta' : 'disponible',
  });
}

async function handleRouteEvent(base44, eventType, currentData, oldData) {
  const affectedVehicleIds = Array.from(new Set([
    currentData?.vehiculo_id,
    oldData?.vehiculo_id,
  ].filter(Boolean)));
  const affectedDriverIds = Array.from(new Set([
    currentData?.chofer_id,
    oldData?.chofer_id,
  ].filter(Boolean)));

  for (const vehicleId of affectedVehicleIds) {
    await syncVehicle(base44, vehicleId);
  }

  for (const driverId of affectedDriverIds) {
    await syncDriver(base44, driverId);
  }

  return {
    entity: 'Ruta',
    eventType,
    syncedVehicles: affectedVehicleIds.length,
    syncedDrivers: affectedDriverIds.length,
  };
}

async function handleSeguimientoEvent(base44, currentData) {
  if (!currentData?.ruta_id) {
    return { entity: 'SeguimientoRuta', ignored: true };
  }

  const nextRouteState = ROUTE_STATUS_MAP[currentData.estado] || 'planificada';
  await base44.asServiceRole.entities.Ruta.update(currentData.ruta_id, {
    estado: nextRouteState,
  });

  if (currentData.carga_ruta_id && LOAD_STATUS_MAP[currentData.estado]) {
    await base44.asServiceRole.entities.CargaRuta.update(currentData.carga_ruta_id, {
      estado_entrega: LOAD_STATUS_MAP[currentData.estado],
    });

    const load = await getEntityRecord(base44, 'CargaRuta', currentData.carga_ruta_id);
    if (load?.package_id && PACKAGE_STATUS_MAP[LOAD_STATUS_MAP[currentData.estado]]) {
      await base44.asServiceRole.entities.Package.update(load.package_id, {
        status: PACKAGE_STATUS_MAP[LOAD_STATUS_MAP[currentData.estado]],
      });
    }
  }

  return {
    entity: 'SeguimientoRuta',
    routeId: currentData.ruta_id,
    routeState: nextRouteState,
  };
}

async function handleCargaEvent(base44, currentData) {
  if (!currentData?.package_id || !PACKAGE_STATUS_MAP[currentData.estado_entrega]) {
    return { entity: 'CargaRuta', ignored: true };
  }

  await base44.asServiceRole.entities.Package.update(currentData.package_id, {
    status: PACKAGE_STATUS_MAP[currentData.estado_entrega],
  });

  return {
    entity: 'CargaRuta',
    packageId: currentData.package_id,
    packageStatus: PACKAGE_STATUS_MAP[currentData.estado_entrega],
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const event = payload?.event || {};
    const entityName = event.entity_name;
    const eventType = event.type;

    const currentData = payload?.payload_too_large
      ? await getEntityRecord(base44, entityName, event.entity_id)
      : payload?.data || null;
    const oldData = payload?.old_data || null;

    if (entityName === 'Ruta') {
      const result = await handleRouteEvent(base44, eventType, currentData, oldData);
      return Response.json({ ok: true, result });
    }

    if (entityName === 'SeguimientoRuta' && currentData) {
      const result = await handleSeguimientoEvent(base44, currentData);
      return Response.json({ ok: true, result });
    }

    if (entityName === 'CargaRuta' && currentData) {
      const result = await handleCargaEvent(base44, currentData);
      return Response.json({ ok: true, result });
    }

    return Response.json({ ok: true, ignored: true, entityName, eventType });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});