export const ROLE_PRESETS = {
  administrador: {
    role_code: 'administrador',
    role_name: 'Administrador',
    description: 'Acceso completo a todos los módulos del sistema, sin restricciones.',
    visible_pages: []
  },
  operaciones: {
    role_code: 'operaciones',
    role_name: 'Operaciones',
    description: 'Gestión operativa de paquetes, consolidaciones y seguimiento.',
    visible_pages: ['AdminDashboard', 'AdminOperaciones', 'AdminLogistica', 'ClientAnalytics', 'AdminPackages', 'AdminVehiculos', 'AdminChoferes', 'AdminRutas', 'AdminRutaDetalle', 'AdminCargaRutas', 'AdminSeguimientoRutas', 'AdminActivityAudit', 'AdminConsolidate', 'AdminShipmentApprovals', 'ShipmentTracking', 'AdminInternalMessages']
  },
  almacen: {
    role_code: 'almacen',
    role_name: 'Almacén',
    description: 'Recepción, ubicaciones, picking y packing.',
    visible_pages: ['AdminDashboard', 'WarehouseDashboard', 'WarehouseReceive', 'WarehouseLocations', 'WarehousePickPackShip', 'WarehouseBultos', 'AdminInternalMessages']
  },
  contabilidad: {
    role_code: 'contabilidad',
    role_name: 'Contabilidad',
    description: 'Facturación, pagos, proveedores y cuentas por pagar.',
    visible_pages: ['AdminDashboard', 'AccountingDashboard', 'AdminInvoices', 'AdminPayments', 'AdminAssistedPayments', 'AdminAccountsPayable', 'AdminProviderPayments', 'AdminProviders', 'AdminPaymentAlerts']
  },
  soporte: {
    role_code: 'soporte',
    role_name: 'Soporte',
    description: 'Atención al cliente, tickets y ayuda.',
    visible_pages: ['AdminDashboard', 'AdminClients', 'AdminSupportTickets', 'AdminInternalMessages', 'AdminFAQ', 'ClientAnalytics']
  },
  marketing: {
    role_code: 'marketing',
    role_name: 'Marketing',
    description: 'Campañas, plantillas, promociones, blog y referidos.',
    visible_pages: ['AdminDashboard', 'AdminEmailCampaigns', 'AdminEmailTemplates', 'AdminPromotions', 'AdminMarketing', 'AdminBlog', 'AdminReferrals']
  },
  logistica: {
    role_code: 'logistica',
    role_name: 'Logística',
    description: 'Vehículos, choferes, rutas, cargas y detalle operativo.',
    visible_pages: ['AdminDashboard', 'AdminLogistica', 'AdminVehiculos', 'AdminChoferes', 'AdminRutas', 'AdminRutaDetalle', 'AdminCargaRutas', 'AdminInternalMessages']
  },
  comunicaciones: {
    role_code: 'comunicaciones',
    role_name: 'Comunicaciones',
    description: 'Campañas, plantillas y alertas de comunicación.',
    visible_pages: ['AdminDashboard', 'AdminEmailCampaigns', 'AdminEmailTemplates', 'AdminPaymentAlerts']
  },
  seguimiento: {
    role_code: 'seguimiento',
    role_name: 'Seguimiento',
    description: 'Monitoreo de rutas, tracking y avances de entrega.',
    visible_pages: ['AdminDashboard', 'AdminSeguimiento', 'AdminLogistica', 'AdminRutas', 'AdminRutaDetalle', 'AdminSeguimientoRutas', 'AdminActivityAudit', 'ShipmentTracking', 'AdminInsured', 'AdminInternalMessages']
  },
  equipo_y_acceso: {
    role_code: 'equipo_y_acceso',
    role_name: 'Equipo y Acceso',
    description: 'Gestión de empleados, administradores, roles y auditoría.',
    visible_pages: ['AdminDashboard', 'AdminEmployees', 'AdminAdministrators', 'AdminRoles', 'AdminEmployeeAudit', 'AdminEmployeePerformance']
  },
};

export const ROLE_OPTIONS = Object.keys(ROLE_PRESETS);

export const PAGE_LABELS = {
  AdminDashboard: 'Dashboard Admin',
  ClientAnalytics: 'Análisis Cliente',
  AdminOperaciones: 'Dashboard Operaciones',
  AdminSeguimiento: 'Dashboard Seguimiento',
  AdminActivityAudit: 'Auditoría Actividad',
  AdminLogistica: 'Logística',
  AdminRutaDetalle: 'Detalle de Ruta',
  AdminPackages: 'Paquetes',
  AdminVehiculos: 'Vehículos',
  AdminChoferes: 'Choferes',
  AdminRutas: 'Rutas',
  AdminCargaRutas: 'Cargas de Ruta',
  AdminSeguimientoRutas: 'Seguimiento de Rutas',
  AdminConsolidate: 'Aprobaciones',
  AdminShipmentApprovals: 'Consolidar',
  WarehouseDashboard: 'Dashboard Almacén',
  WarehouseReceive: 'Recepción Almacén',
  WarehouseLocations: 'Ubicaciones y Sedes',
  WarehousePickPackShip: 'Picking y Packing',
  WarehouseBultos: 'Empaque de Bultos',
  WarehouseDispatch: 'Despacho Escáner',
  WarehouseDispatchScanHistory: 'Historial de Escaneos',
  DispatchGuides: 'Guías de Despacho',
  DispatchLabels: 'Etiquetas de Despacho',
  AccountingDashboard: 'Dashboard Contabilidad',
  AdminInvoices: 'Facturas',
  AdminPayments: 'Validar Pagos',
  AdminAssistedPayments: 'Pagos Asistidos',
  AdminAccountsPayable: 'Cuentas por Pagar',
  AdminProviderPayments: 'Pagos Proveedores',
  AdminProviders: 'Proveedores',
  AdminPaymentAlerts: 'Alertas de Pago',
  AdminSupportTickets: 'Tickets Soporte',
  AdminFAQ: 'Gestionar FAQ',
  AdminClients: 'Clientes',
  AdminEmployees: 'Empleados',
  AdminEmployeeAudit: 'Auditoría de Acciones',
  AdminEmployeePerformance: 'Rendimiento Empleados',
  AdminInternalMessages: 'Mensajería Interna',
  AdminEmailCampaigns: 'Enviar Emails',
  AdminEmailTemplates: 'Plantillas Email',
  AdminPromotions: 'Promociones',
  AdminMarketing: 'Marketing',
  AdminBlog: 'Blog',
  AdminReferrals: 'Referidos',
  ShipmentTracking: 'Seguimiento'
};

export function getDefaultRoleConfig(roleCode) {
  return ROLE_PRESETS[roleCode] || null;
}

// Asegura que exista un RoleConfig en la base de datos con los permisos
// predeterminados del área. Se llama al asignar un área a un empleado para
// que sus permisos queden aplicados automáticamente.
export async function ensureRoleConfig(base44, roleCode) {
  const preset = ROLE_PRESETS[roleCode];
  if (!preset) return null;
  const rows = await base44.entities.RoleConfig.filter({ role_code: roleCode }, '-updated_date', 1);
  if (rows?.length) return rows[0];
  return base44.entities.RoleConfig.create({
    role_code: roleCode,
    role_name: preset.role_name,
    description: preset.description,
    visible_pages: preset.visible_pages || [],
    is_active: true,
  });
}