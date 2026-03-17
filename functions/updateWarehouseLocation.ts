import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function hasWarehouseAccess(user) {
  return user?.role === 'admin' || ['warehouse', 'operations_manager'].includes(user?.custom_role);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasWarehouseAccess(user)) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const locationId = String(body?.location_id || '').trim();
    if (!locationId) {
      return Response.json({ error: 'location_id es obligatorio' }, { status: 400 });
    }

    const current = await base44.asServiceRole.entities.WarehouseLocation.get(locationId);
    if (!current) {
      return Response.json({ error: 'Ubicación no encontrada' }, { status: 404 });
    }

    const nextCode = body?.code ? String(body.code).trim().toUpperCase() : current.code;
    if (nextCode !== current.code) {
      const existing = await base44.asServiceRole.entities.WarehouseLocation.filter({ code: nextCode }, '-created_date', 1);
      if (existing?.length && existing[0]?.id !== locationId) {
        return Response.json({ error: 'Ya existe una ubicación con ese código' }, { status: 409 });
      }
    }

    const updates = {
      name: body?.name ?? current.name,
      code: nextCode,
      zone: body?.zone ?? current.zone,
      type: body?.type ?? current.type,
      capacity_units: body?.capacity_units ?? current.capacity_units,
      capacity_volume_cbm: body?.capacity_volume_cbm ?? current.capacity_volume_cbm,
      capacity_weight_kg: body?.capacity_weight_kg ?? current.capacity_weight_kg,
      is_active: body?.is_active ?? current.is_active,
      notes: body?.notes ?? current.notes
    };

    const location = await base44.asServiceRole.entities.WarehouseLocation.update(locationId, updates);
    return Response.json({ success: true, location });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});