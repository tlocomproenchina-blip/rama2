export const ROLE_PRESETS = {
  operaciones: {
    role_code: 'operaciones',
    role_name: 'Operaciones',
    description: 'Gestión operativa de paquetes, consolidaciones y seguimiento.',
    visible_pages: ['AdminDashboard', 'AdminOperaciones', 'AdminLogistica', 'ClientAnalytics', 'AdminPackages', 'AdminVehiculos', 'AdminChoferes', 'AdminRutas', 'AdminRutaDetalle', 'AdminCargaRutas', 'AdminSeguimientoRutas', 'AdminConsolidate', 'AdminShipmentApprovals', 'ShipmentTracking']
  },
  almacen: {
    role_code: 'almacen',
    role_name: 'Almacén',
    description: 'Recepción, ubicaciones, picking y packing.',
    visible_pages: ['AdminDashboard', 'WarehouseDashboard', 'WarehouseReceive', 'WarehouseLocations', 'WarehousePickPackShip']
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
    visible_pages: ['AdminDashboard', 'AdminClients', 'AdminSupportTickets', 'AdminFAQ', 'ClientAnalytics']
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
    visible_pages: ['AdminDashboard', 'AdminLogistica', 'AdminVehiculos', 'AdminChoferes', 'AdminRutas', 'AdminRutaDetalle', 'AdminCargaRutas']
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
    visible_pages: ['AdminDashboard', 'AdminSeguimiento', 'AdminLogistica', 'AdminRutas', 'AdminRutaDetalle', 'AdminSeguimientoRutas', 'ShipmentTracking', 'AdminInsured']
  },
  equipo_y_acceso: {
    role_code: 'equipo_y_acceso',
    role_name: 'Equipo y Acceso',
    description: 'Gestión de empleados, administradores, roles y auditoría.',
    visible_pages: ['AdminDashboard', 'AdminEmployees', 'AdminAdministrators', 'AdminRoles', 'AdminEmployeeAudit']
  }
};

export const ROLE_OPTIONS = Object.keys(ROLE_PRESETS);

export const PAGE_LABELS = {
  AdminDashboard: 'Dashboard Admin',
  ClientAnalytics: 'Análisis Cliente',
  AdminOperaciones: 'Dashboard Operaciones',
  AdminSeguimiento: 'Dashboard Seguimiento',
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