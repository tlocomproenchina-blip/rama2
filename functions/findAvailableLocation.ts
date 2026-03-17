import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function hasWarehouseAccess(user) {
  return user?.role === 'admin' || ['warehouse', 'operations_manager'].includes(user?.custom_role);
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
    if (!hasWarehouseAccess(user)) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const zone = body?.zone ? String(body.zone).trim() : null;
    const minUnits = Number(body?.min_units ?? 1);
    const minVolume = Number(body?.min_volume_cbm ?? 0);
    const minWeight = Number(body?.min_weight_kg ?? 0);

    const query = zone ? { is_active: true, zone } : { is_active: true };
    const locations = await base44.asServiceRole.entities.WarehouseLocation.filter(query, 'code', 200);

    const matches = (locations || []).filter((location) => {
      const unitsLeft = remaining(location.capacity_units, location.current_units);
      const volumeLeft = remaining(location.capacity_volume_cbm, location.current_volume_cbm);
      const weightLeft = remaining(location.capacity_weight_kg, location.current_weight_kg);
      return unitsLeft >= minUnits && volumeLeft >= minVolume && weightLeft >= minWeight;
    }).sort((a, b) => {
      const aScore = remaining(a.capacity_units, a.current_units) + remaining(a.capacity_volume_cbm, a.current_volume_cbm) + remaining(a.capacity_weight_kg, a.current_weight_kg);
      const bScore = remaining(b.capacity_units, b.current_units) + remaining(b.capacity_volume_cbm, b.current_volume_cbm) + remaining(b.capacity_weight_kg, b.current_weight_kg);
      return aScore - bScore;
    });

    return Response.json({ success: true, best_match: matches[0] || null, matches });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});