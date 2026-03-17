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
    const name = String(body?.name || '').trim();
    const code = String(body?.code || '').trim().toUpperCase();
    const city = String(body?.city || '').trim();
    const country = String(body?.country || '').trim();

    if (!name || !code || !city || !country) {
      return Response.json({ error: 'name, code, city y country son obligatorios' }, { status: 400 });
    }

    const existing = await base44.asServiceRole.entities.Warehouse.filter({ code }, '-created_date', 1);
    if (existing?.length) return Response.json({ error: 'Ya existe un almacén con ese código' }, { status: 409 });

    const warehouse = await base44.asServiceRole.entities.Warehouse.create({
      name,
      code,
      city,
      country,
      address: body?.address || '',
      notes: body?.notes || '',
      is_active: body?.is_active !== false,
    });

    return Response.json({ success: true, warehouse });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});