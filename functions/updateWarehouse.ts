import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

async function hasWarehouseAccess(base44, user, allowedPages) {
  if (user?.role === 'admin') return true;
  if (['warehouse', 'operations_manager'].includes(user?.custom_role)) return true;
  if (!user?.custom_role) return false;
  const roles = await base44.asServiceRole.entities.RoleConfig.filter({ role_code: user.custom_role, is_active: true }, '-updated_date', 1);
  const role = roles?.[0];
  const visiblePages = role?.visible_pages || [];
  return allowedPages.some((page) => visiblePages.includes(page));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await hasWarehouseAccess(base44, user, ['WarehouseLocations']))) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const warehouseId = String(body?.warehouse_id || '').trim();
    if (!warehouseId) return Response.json({ error: 'warehouse_id es obligatorio' }, { status: 400 });

    const current = await base44.asServiceRole.entities.Warehouse.get(warehouseId);
    if (!current) return Response.json({ error: 'Almacén no encontrado' }, { status: 404 });

    const nextCode = body?.code ? String(body.code).trim().toUpperCase() : current.code;
    if (nextCode !== current.code) {
      const existing = await base44.asServiceRole.entities.Warehouse.filter({ code: nextCode }, '-created_date', 1);
      if (existing?.length && existing[0]?.id !== warehouseId) return Response.json({ error: 'Ya existe un almacén con ese código' }, { status: 409 });
    }

    const warehouse = await base44.asServiceRole.entities.Warehouse.update(warehouseId, {
      name: body?.name ?? current.name,
      code: nextCode,
      city: body?.city ?? current.city,
      country: body?.country ?? current.country,
      address: body?.address ?? current.address,
      notes: body?.notes ?? current.notes,
      is_active: body?.is_active ?? current.is_active,
    });

    return Response.json({ success: true, warehouse });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});