import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { sanitizeUser } from '../../shared/userSanitize.ts';
import { ROLE_PRESETS } from '../../shared/roleAreas.ts';

// Asigna un área (custom_role) a un administrador desde el backend.
// - Valida permisos del solicitante (admin)
// - Impide auto-asignación
// - Actualiza User.custom_role
// - Asegura que exista un RoleConfig con los permisos predeterminados del área
// - Registra auditoría en EmployeeAuditLog
// - Devuelve el usuario actualizado (sanitizado) y el role_config

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
    const targetUserId = (body.target_user_id || '').toString().trim();
    const nextRole = (body.next_role || '').toString().trim(); // role_code o 'sin_area'

    if (!targetUserId) {
      return Response.json({ error: 'target_user_id es requerido' }, { status: 400 });
    }
    if (nextRole !== 'sin_area' && nextRole !== 'pasar_a_cliente' && !ROLE_PRESETS[nextRole]) {
      return Response.json({ error: 'Área no válida' }, { status: 400 });
    }
    if (targetUserId === user.id) {
      return Response.json({ error: 'No puedes cambiar tu propia asignación' }, { status: 400 });
    }

    // Obtener usuario objetivo
    const targetUser = await base44.asServiceRole.entities.User.get(targetUserId);
    if (!targetUser) {
      return Response.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }
    if (targetUser.role !== 'admin') {
      return Response.json({ error: 'El usuario no es administrador' }, { status: 400 });
    }

    const previousRole = targetUser.custom_role || null;

    // Caso especial: convertir administrador en cliente regular
    if (nextRole === 'pasar_a_cliente') {
      await base44.asServiceRole.entities.User.update(targetUserId, { role: 'user', custom_role: null });

      try {
        await base44.asServiceRole.entities.EmployeeAuditLog.create({
          actor_email: user.email || 'system',
          actor_name: user.full_name || '',
          target_email: targetUser.email,
          target_name: targetUser.full_name || targetUser.email,
          action_type: 'demote_admin',
          area_code: '',
          area_name: 'Cliente',
          summary: `Quitó acceso admin a ${targetUser.full_name || targetUser.email}`,
          details: 'El usuario fue cambiado de administrador a usuario regular desde Roles por área',
          changed_fields: ['role', 'custom_role'],
        });
      } catch (e) {
        console.error('audit log error:', e.message);
      }

      const sanitized = sanitizeUser({ ...targetUser, role: 'user', custom_role: null });
      return Response.json({ success: true, user: sanitized, role_config: null, demoted: true });
    }

    const newRoleValue = nextRole === 'sin_area' ? null : nextRole;

    // Actualizar custom_role
    await base44.asServiceRole.entities.User.update(targetUserId, { custom_role: newRoleValue });

    // Asegurar RoleConfig con permisos predeterminados
    let roleConfig = null;
    if (nextRole !== 'sin_area') {
      const preset = ROLE_PRESETS[nextRole];
      const existing = await base44.asServiceRole.entities.RoleConfig.filter({ role_code: nextRole }, '-updated_date', 1);
      if (existing && existing.length > 0) {
        roleConfig = existing[0];
      } else {
        roleConfig = await base44.asServiceRole.entities.RoleConfig.create({
          role_code: nextRole,
          role_name: preset.role_name,
          description: preset.description,
          visible_pages: preset.visible_pages || [],
          is_active: true,
        });
      }
    }

    // Auditoría
    const areaName = nextRole === 'sin_area' ? 'Sin área' : (ROLE_PRESETS[nextRole]?.role_name || nextRole);
    const previousAreaName = previousRole ? (ROLE_PRESETS[previousRole]?.role_name || previousRole) : 'sin área';
    try {
      await base44.asServiceRole.entities.EmployeeAuditLog.create({
        actor_email: user.email || 'system',
        actor_name: user.full_name || '',
        target_email: targetUser.email,
        target_name: targetUser.full_name || targetUser.email,
        action_type: 'assign_area',
        area_code: nextRole === 'sin_area' ? '' : nextRole,
        area_name: areaName,
        summary: `Asignó área a ${targetUser.full_name || targetUser.email}`,
        details: `Área anterior: ${previousAreaName} · Nueva área: ${areaName}`,
        changed_fields: ['custom_role'],
      });
    } catch (e) {
      console.error('audit log error:', e.message);
    }

    // Devolver usuario actualizado sanitizado
    const updated = { ...targetUser, custom_role: newRoleValue };
    const sanitized = sanitizeUser(updated);

    return Response.json({
      success: true,
      user: sanitized,
      role_config: roleConfig,
    });
  } catch (error) {
    console.error('manageRoleAssignment error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});