import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

// Guarda (upsert) los permisos de un área en RoleConfig desde el backend.
// - Valida permisos del solicitante (admin)
// - Valida role_code contra la lista de áreas válidas
// - Crea o actualiza el RoleConfig
// - Registra auditoría en EmployeeAuditLog
// - Devuelve el RoleConfig guardado

const VALID_ROLES = [
  'administrador', 'operaciones', 'almacen', 'contabilidad', 'soporte',
  'marketing', 'logistica', 'comunicaciones', 'seguimiento', 'equipo_y_acceso',
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const roleCode = (body.role_code || '').toString().trim();
    const roleName = (body.role_name || '').toString().trim();
    const description = (body.description || '').toString().trim();
    const visiblePages = Array.isArray(body.visible_pages) ? body.visible_pages : [];
    const isActive = body.is_active !== false;

    if (!roleCode || !VALID_ROLES.includes(roleCode)) {
      return Response.json({ error: 'Área no válida' }, { status: 400 });
    }
    if (!roleName) {
      return Response.json({ error: 'role_name es requerido' }, { status: 400 });
    }

    // Buscar config existente
    const existing = await base44.asServiceRole.entities.RoleConfig.filter({ role_code: roleCode }, '-updated_date', 1);
    let savedConfig;

    if (existing && existing.length > 0) {
      const configId = existing[0].id;
      savedConfig = await base44.asServiceRole.entities.RoleConfig.update(configId, {
        role_name: roleName,
        description: description,
        visible_pages: visiblePages,
        is_active: isActive,
      });
    } else {
      savedConfig = await base44.asServiceRole.entities.RoleConfig.create({
        role_code: roleCode,
        role_name: roleName,
        description: description,
        visible_pages: visiblePages,
        is_active: isActive,
      });
    }

    // Auditoría
    try {
      await base44.asServiceRole.entities.EmployeeAuditLog.create({
        actor_email: user.email || 'system',
        actor_name: user.full_name || '',
        target_email: '',
        target_name: roleName,
        action_type: 'save_permissions',
        area_code: roleCode,
        area_name: roleName,
        summary: `Actualizó permisos del área ${roleName}`,
        details: `Módulos visibles configurados: ${visiblePages.join(', ') || 'ninguno'}`,
        changed_fields: ['visible_pages'],
      });
    } catch (e) {
      console.error('audit log error:', e.message);
    }

    return Response.json({ success: true, role_config: savedConfig });
  } catch (error) {
    console.error('saveRolePermissions error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});