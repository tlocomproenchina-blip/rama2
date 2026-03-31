import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const MAPBOX_API_KEY = Deno.env.get('MAPBOX_API_KEY');

function buildSummary(routeCode, stopCount, optimizedStopCount, distanceKm, durationMin, missingCount) {
  return `Ruta ${routeCode || ''}: ${optimizedStopCount}/${stopCount} entregas optimizadas · ${distanceKm.toFixed(1)} km · ${Math.round(durationMin)} min${missingCount ? ` · ${missingCount} sin ubicación suficiente` : ''}`.trim();
}

async function geocodePlace(query, cache) {
  if (!query) return null;
  if (cache.has(query)) return cache.get(query);

  const encoded = encodeURIComponent(query);
  const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${MAPBOX_API_KEY}&limit=1&country=VE&language=es`);
  const data = await response.json();
  const feature = data?.features?.[0] || null;
  const result = feature ? {
    longitude: feature.center[0],
    latitude: feature.center[1],
    place_name: feature.place_name,
  } : null;

  cache.set(query, result);
  return result;
}

async function upsertPlan(base44, routeId, payload) {
  const existingRows = await base44.asServiceRole.entities.RouteOptimizationPlan.filter({ route_id: routeId }, '-updated_date', 1);
  if (existingRows?.[0]?.id) {
    return await base44.asServiceRole.entities.RouteOptimizationPlan.update(existingRows[0].id, payload);
  }
  return await base44.asServiceRole.entities.RouteOptimizationPlan.create(payload);
}

async function getRouteIdFromPayload(payload) {
  if (payload?.routeId) return String(payload.routeId);
  if (payload?.event?.entity_name === 'Ruta') return String(payload?.event?.entity_id || payload?.data?.id || '');
  if (payload?.event?.entity_name === 'CargaRuta') return String(payload?.data?.ruta_id || payload?.old_data?.ruta_id || '');
  return '';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const mode = payload?.event ? 'automatic' : String(payload?.mode || 'manual');
    const routeId = await getRouteIdFromPayload(payload);

    if (!MAPBOX_API_KEY) {
      return Response.json({ error: 'MAPBOX_API_KEY is not configured' }, { status: 500 });
    }

    if (!routeId) {
      return Response.json({ error: 'routeId is required' }, { status: 400 });
    }

    const routeRows = await base44.asServiceRole.entities.Ruta.filter({ id: routeId }, '-updated_date', 1);
    const route = routeRows?.[0] || null;
    if (!route) {
      return Response.json({ error: 'Route not found' }, { status: 404 });
    }

    const loads = await base44.asServiceRole.entities.CargaRuta.filter({ ruta_id: routeId }, '-updated_date', 200);
    const cache = new Map();

    const originQuery = `${route.origen}, Venezuela`;
    const origin = await geocodePlace(originQuery, cache);
    if (!origin) {
      const plan = await upsertPlan(base44, routeId, {
        route_id: routeId,
        route_code: route.codigo_ruta || '',
        optimization_mode: mode,
        objective: 'distance',
        status: 'insufficient_data',
        origin_label: route.origen || '',
        stop_count: loads.length,
        optimized_stop_count: 0,
        missing_location_count: loads.length,
        ordered_load_ids: [],
        ordered_stop_labels: [],
        total_distance_km: 0,
        estimated_duration_min: 0,
        summary_text: 'No se pudo geocodificar el origen de la ruta.',
        calculated_at: new Date().toISOString(),
      });
      return Response.json({ ok: true, plan, routeId, reason: 'origin_not_found' });
    }

    const userCache = new Map();
    const stopCandidates = [];
    const missingLoads = [];

    for (const load of loads || []) {
      let label = '';
      if (load.client_email) {
        if (!userCache.has(load.client_email)) {
          const userRows = await base44.asServiceRole.entities.User.filter({ email: load.client_email }, '-updated_date', 1);
          userCache.set(load.client_email, userRows?.[0] || null);
        }
        const user = userCache.get(load.client_email);
        if (user?.city && user?.state) {
          label = `${user.city}, ${user.state}, Venezuela`;
        }
      }

      if (!label) {
        missingLoads.push(load);
        continue;
      }

      const geo = await geocodePlace(label, cache);
      if (!geo) {
        missingLoads.push(load);
        continue;
      }

      stopCandidates.push({
        loadId: load.id,
        trackingNumber: load.tracking_number || '',
        label,
        longitude: geo.longitude,
        latitude: geo.latitude,
      });
    }

    if (stopCandidates.length < 2) {
      const plan = await upsertPlan(base44, routeId, {
        route_id: routeId,
        route_code: route.codigo_ruta || '',
        optimization_mode: mode,
        objective: 'distance',
        status: 'insufficient_data',
        origin_label: route.origen || '',
        stop_count: loads.length,
        optimized_stop_count: stopCandidates.length,
        missing_location_count: missingLoads.length,
        ordered_load_ids: stopCandidates.map((item) => item.loadId),
        ordered_stop_labels: stopCandidates.map((item) => item.label),
        total_distance_km: 0,
        estimated_duration_min: 0,
        summary_text: 'Se necesitan al menos 2 entregas con estado y ciudad válidos para optimizar la ruta.',
        calculated_at: new Date().toISOString(),
      });
      return Response.json({ ok: true, plan, routeId, reason: 'insufficient_stops' });
    }

    const coords = [
      `${origin.longitude},${origin.latitude}`,
      ...stopCandidates.map((item) => `${item.longitude},${item.latitude}`),
    ].join(';');

    const optimizationResponse = await fetch(`https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coords}?access_token=${MAPBOX_API_KEY}&source=first&destination=any&roundtrip=false&steps=false&overview=full&geometries=geojson`);
    const optimizationData = await optimizationResponse.json();

    if (!optimizationResponse.ok) {
      return Response.json({ error: optimizationData?.message || 'Optimization failed' }, { status: 500 });
    }

    const orderedStops = stopCandidates
      .map((stop, index) => ({
        ...stop,
        waypointIndex: optimizationData?.waypoints?.[index + 1]?.waypoint_index ?? index + 1,
      }))
      .sort((a, b) => a.waypointIndex - b.waypointIndex);

    const trip = optimizationData?.trips?.[0] || {};
    const distanceKm = Number(trip.distance || 0) / 1000;
    const durationMin = Number(trip.duration || 0) / 60;

    const plan = await upsertPlan(base44, routeId, {
      route_id: routeId,
      route_code: route.codigo_ruta || '',
      optimization_mode: mode,
      objective: 'distance',
      status: 'ready',
      origin_label: route.origen || '',
      stop_count: loads.length,
      optimized_stop_count: orderedStops.length,
      missing_location_count: missingLoads.length,
      ordered_load_ids: orderedStops.map((item) => item.loadId),
      ordered_stop_labels: orderedStops.map((item) => item.label),
      total_distance_km: Number(distanceKm.toFixed(2)),
      estimated_duration_min: Math.round(durationMin),
      summary_text: buildSummary(route.codigo_ruta, loads.length, orderedStops.length, distanceKm, durationMin, missingLoads.length),
      calculated_at: new Date().toISOString(),
    });

    return Response.json({
      ok: true,
      routeId,
      plan,
      orderedStops,
      missingLoads: missingLoads.map((load) => ({ id: load.id, tracking_number: load.tracking_number || '', client_email: load.client_email || '' })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});