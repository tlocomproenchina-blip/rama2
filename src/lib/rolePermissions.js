export const ROLE_PRESETS = {
  operaciones: {
    role_code: 'operaciones',
    role_name: 'Operaciones',
    description: 'Gestión operativa de paquetes, consolidaciones y seguimiento.',
    visible_pages: ['AdminDashboard', 'ClientAnalytics', 'AdminPackages', 'AdminConsolidate', 'AdminShipmentApprovals', 'ShipmentTracking', 'AdminVehiculos', 'AdminChoferes']
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
  }
};

export const ROLE_OPTIONS = Object.keys(ROLE_PRESETS);

export const PAGE_LABELS = {
  AdminDashboard: 'Dashboard Admin',
  ClientAnalytics: 'Análisis Cliente',
  AdminPackages: 'Paquetes',
  AdminVehiculos: 'Vehículos',
  AdminChoferes: 'Choferes',
  AdminRutas: 'Rutas',
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
  AdminVehiculos: 'Vehículos',
  AdminChoferes: 'Choferes',
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