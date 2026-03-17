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
    const name = String(body?.name || '').trim();
    const code = String(body?.code || '').trim().toUpperCase();
    const zone = String(body?.zone || '').trim();
    const type = String(body?.type || '').trim();

    if (!name || !code || !zone || !type) {
      return Response.json({ error: 'name, code, zone y type son obligatorios' }, { status: 400 });
    }

    const existing = await base44.asServiceRole.entities.WarehouseLocation.filter({ code }, '-created_date', 1);
    if (existing?.length) {
      return Response.json({ error: 'Ya existe una ubicación con ese código' }, { status: 409 });
    }

    const location = await base44.asServiceRole.entities.WarehouseLocation.create({
      name,
      code,
      zone,
      type,
      capacity_units: body?.capacity_units,
      capacity_volume_cbm: body?.capacity_volume_cbm,
      capacity_weight_kg: body?.capacity_weight_kg,
      current_units: 0,
      current_volume_cbm: 0,
      current_weight_kg: 0,
      is_active: body?.is_active !== false,
      notes: body?.notes || ''
    });

    return Response.json({ success: true, location });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});