import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

// Devuelve todos los clientes (role='user') con campos mínimos para el
// escaneo offline-first de WarehouseScanPack. Usa asServiceRole para saltar
// el RLS integrado de User (que solo permite listar a admins completos),
// permitiendo que empleados de almacén con custom_role puedan descargar los
// clientes a IndexedDB.
//
// Permisos: user.role === 'admin' OR user.custom_role definido (cualquier
// rol limitado con acceso a páginas de bodega). 403 en caso contrario.
//
// Parámetros (body JSON):
//   skip: number — paginación (default 0)
//   limit: number — tamaño de página (default 500, máx 500)
//
// Respuesta:
//   { clients: [...], total: number, skip: number, limit: number, hasMore: boolean }

const SAFETY_CAP = 5000;

function sanitize(u) {
  return {
    id: u.id,
    email: u.email,
    full_name: u.full_name || null,
    first_name: u.first_name || null,
    last_name: u.last_name || null,
    cedula: u.cedula || null,
    shipping_mark: u.shipping_mark || null,
    whatsapp: u.whatsapp || null,
    phone: u.phone || null,
    address: u.address || null,
    city: u.city || null,
    state: u.state || null,
    is_active: u.is_active !== false,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin completo o cualquier rol limitado (custom_role) con acceso a bodega
    const allowed = user.role === 'admin' || !!user.custom_role;
    if (!allowed) {
      return Response.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(parseInt(body.limit) || 500, 1), 500);
    const skip = Math.max(parseInt(body.skip) || 0, 0);

    const batch = await base44.asServiceRole.entities.User.filter(
      { role: 'user' }, '-created_date', limit, skip
    );

    const clients = (batch || [])
      .filter((u) => u && u.id && u.email && u.custom_role !== 'super_admin_oculto')
      .map(sanitize);

    const hasMore = batch && batch.length === limit && (skip + limit) < SAFETY_CAP;

    return Response.json({
      clients,
      total: clients.length,
      skip,
      limit,
      hasMore,
    });
  } catch (error) {
    console.error('getWarehouseClients error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});