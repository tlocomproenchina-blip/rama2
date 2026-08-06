import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { sanitizeUser } from '../../shared/userSanitize.ts';

// Asigna un área (custom_role) a un administrador desde el backend.
// - Valida permisos del solicitante (admin)
// - Impide auto-asignación
// - Actualiza User.custom_role
// - Asegura que exista un RoleConfig con los permisos predeterminados del área
// - Registra auditoría en EmployeeAuditLog
// - Devuelve el usuario actualizado (sanitizado) y el role_config

const ROLE_PRESETS = {
  administrador: { role_name: 'Administrador', description: 'Acceso completo a todos los módulos del sistema, sin restricciones.', visible_pages: [] },
  operaciones: { role_name: 'Operaciones', description: 'Gestión operativa de paquetes, consolidaciones y seguimiento.', visible_pages: ['AdminDashboard', 'AdminOperaciones', 'AdminLogistica', 'ClientAnalytics', 'AdminPackages', 'AdminVehiculos', 'AdminChoferes', 'AdminRutas', 'AdminRutaDetalle', 'AdminCargaRutas', 'AdminSeguimientoRutas', 'AdminActivityAudit', 'AdminConsolidate', 'AdminShipmentApprovals', 'ShipmentTracking', 'AdminInternalMessages'] },
  almacen: { role_name: 'Almacén', description: 'Recepción, ubicaciones, picking y packing.', visible_pages: ['AdminDashboard', 'WarehouseDashboard', 'WarehouseReceive', 'WarehouseLocations', 'WarehousePickPackShip', 'AdminInternalMessages'] },
  contabilidad: { role_name: 'Contabilidad', description: 'Facturación, pagos, proveedores y cuentas por pagar.', visible_pages: ['AdminDashboard', 'AccountingDashboard', 'AdminInvoices', 'AdminPayments', 'AdminAssistedPayments', 'AdminAccountsPayable', 'AdminProviderPayments', 'AdminProviders', 'AdminPaymentAlerts'] },
  soporte: { role_name: 'Soporte', description: 'Atención al cliente, tickets y ayuda.', visible_pages: ['AdminDashboard', 'AdminClients', 'AdminSupportTickets', 'AdminInternalMessages', 'AdminFAQ', 'ClientAnalytics'] },
  marketing: { role_name: 'Marketing', description: 'Campañas, plantillas, promociones, blog y referidos.', visible_pages: ['AdminDashboard', 'AdminEmailCampaigns', 'AdminEmailTemplates', 'AdminPromotions', 'AdminMarketing', 'AdminBlog', 'AdminReferrals'] },
  logistica: { role_name: 'Logística', description: 'Vehículos, choferes, rutas, cargas y detalle operativo.', visible_pages: ['AdminDashboard', 'AdminLogistica', 'AdminVehiculos', 'AdminChoferes', 'AdminRutas', 'AdminRutaDetalle', 'AdminCargaRutas', 'AdminInternalMessages'] },
  comunicaciones: { role_name: 'Comunicaciones', description: 'Campañas, plantillas y alertas de comunicación.', visible_pages: ['AdminDashboard', 'AdminEmailCampaigns', 'AdminEmailTemplates', 'AdminPaymentAlerts'] },
  seguimiento: { role_name: 'Seguimiento', description: 'Monitoreo de rutas, tracking y avances de entrega.', visible_pages: ['AdminDashboard', 'AdminSeguimiento', 'AdminLogistica', 'AdminRutas', 'AdminRutaDetalle', 'AdminSeguimientoRutas', 'AdminActivityAudit', 'ShipmentTracking', 'AdminInsured', 'AdminInternalMessages'] },
  equipo_y_acceso: { role_name: 'Equipo y Acceso', description: 'Gestión de empleados, administradores, roles y auditoría.', visible_pages: ['AdminDashboard', 'AdminEmployees', 'AdminAdministrators', 'AdminRoles', 'AdminEmployeeAudit', 'AdminEmployeePerformance'] },
};

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
    if (nextRole !== 'sin_area' && !ROLE_PRESETS[nextRole]) {
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