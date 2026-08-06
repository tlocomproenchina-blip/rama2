import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

// Lista todas las configuraciones de roles (RoleConfig) desde el backend.
// Usa asServiceRole para evitar restricciones de permisos.
// Devuelve un mapa { role_code: config } con los presets aplicados como fallback.

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

    const configRows = await base44.asServiceRole.entities.RoleConfig.list('-updated_date', 100);

    const configs = {};
    Object.keys(ROLE_PRESETS).forEach((code) => {
      configs[code] = {
        role_code: code,
        ...ROLE_PRESETS[code],
        visible_pages: ROLE_PRESETS[code].visible_pages || [],
        is_active: true,
      };
    });

    (configRows || []).forEach((row) => {
      if (row?.role_code && configs[row.role_code]) {
        configs[row.role_code] = {
          ...configs[row.role_code],
          ...row,
          visible_pages: row.visible_pages?.length ? row.visible_pages : configs[row.role_code].visible_pages,
        };
      }
    });

    return Response.json({ configs });
  } catch (error) {
    console.error('listRoleConfigs error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});