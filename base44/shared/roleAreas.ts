// Áreas operativas que se asignan a los empleados (rol por área) con sus módulos
// predeterminados. Debe coincidir con ROLE_PRESETS de src/lib/rolePermissions.js:
// el panel y el backend usan la misma lista, así el número de módulos que muestra
// cada área es el que realmente ve el empleado cuando esa área todavía no tiene
// su configuración guardada.
// El código 'administrador' NO es un área de empleado: representa acceso
// completo de administrador, por eso queda fuera de AREA_ROLE_CODES.
export const ROLE_PRESETS: Record<string, { role_name: string; description: string; visible_pages: string[] }> = {
  administrador: {
    role_name: 'Administrador',
    description: 'Acceso completo a todos los módulos del sistema, sin restricciones.',
    visible_pages: [],
  },
  operaciones: {
    role_name: 'Operaciones',
    description: 'Gestión operativa de paquetes, consolidaciones y seguimiento.',
    visible_pages: ['AdminDashboard', 'AdminOperaciones', 'AdminLogistica', 'ClientAnalytics', 'AdminPackages', 'AdminVehiculos', 'AdminChoferes', 'AdminRutas', 'AdminCargaRutas', 'AdminSeguimientoRutas', 'AdminActivityAudit', 'AdminConsolidate', 'AdminShipmentApprovals', 'ShipmentTracking', 'AdminInternalMessages'],
  },
  almacen: {
    role_name: 'Almacén',
    description: 'Recepción, ubicaciones, picking y packing.',
    visible_pages: ['AdminDashboard', 'WarehouseDashboard', 'WarehouseReceive', 'WarehouseLocations', 'WarehousePickPackShip', 'WarehouseBultos', 'AdminInternalMessages'],
  },
  contabilidad: {
    role_name: 'Contabilidad',
    description: 'Facturación, pagos, proveedores y cuentas por pagar.',
    visible_pages: ['AdminDashboard', 'AccountingDashboard', 'AdminInvoices', 'AdminPayments', 'AdminAssistedPayments', 'AdminAccountsPayable', 'AdminProviderPayments', 'AdminProviders', 'AdminPaymentAlerts'],
  },
  soporte: {
    role_name: 'Soporte',
    description: 'Atención al cliente, tickets y ayuda.',
    visible_pages: ['AdminDashboard', 'AdminClients', 'AdminSupportAssistant', 'AdminSupportSupervisor', 'AdminSupportTickets', 'AdminSupportCollections', 'AdminInternalMessages', 'AdminFAQ', 'ClientAnalytics'],
  },
  marketing: {
    role_name: 'Marketing',
    description: 'Campañas, plantillas, promociones, blog y referidos.',
    visible_pages: ['AdminDashboard', 'AdminEmailCampaigns', 'AdminEmailTemplates', 'AdminPromotions', 'AdminMarketing', 'AdminBlog', 'AdminReferrals'],
  },
  logistica: {
    role_name: 'Logística',
    description: 'Vehículos, choferes, rutas, cargas y detalle operativo.',
    visible_pages: ['AdminDashboard', 'AdminLogistica', 'AdminVehiculos', 'AdminChoferes', 'AdminRutas', 'AdminCargaRutas', 'AdminInternalMessages'],
  },
  comunicaciones: {
    role_name: 'Comunicaciones',
    description: 'Campañas, plantillas y alertas de comunicación.',
    visible_pages: ['AdminDashboard', 'AdminEmailCampaigns', 'AdminDeliveryProofCampaign', 'AdminEmailTemplates', 'AdminPaymentAlerts'],
  },
  seguimiento: {
    role_name: 'Seguimiento',
    description: 'Monitoreo de rutas, tracking y avances de entrega.',
    visible_pages: ['AdminDashboard', 'AdminSeguimiento', 'AdminLogistica', 'AdminRutas', 'AdminSeguimientoRutas', 'AdminActivityAudit', 'ShipmentTracking', 'AdminInsured', 'AdminInternalMessages'],
  },
  equipo_y_acceso: {
    role_name: 'Equipo y Acceso',
    description: 'Gestión de empleados, administradores, roles y auditoría.',
    visible_pages: ['AdminDashboard', 'AdminEmployees', 'AdminAdministrators', 'AdminRoles', 'AdminEmployeeAudit', 'AdminEmployeePerformance'],
  },
};

// Áreas que se pueden asignar a un empleado.
export const AREA_ROLE_CODES = Object.keys(ROLE_PRESETS).filter((code) => code !== 'administrador');

export function presetFor(roleCode: any) {
  return ROLE_PRESETS[String(roleCode || '').trim().toLowerCase()] || null;
}

// Un empleado es una cuenta con un área operativa asignada. Las demás cuentas
// con role 'admin' (sin área o con el rol 'administrador') son administradores.
export function isAreaEmployee(user: any) {
  return AREA_ROLE_CODES.includes(String(user?.custom_role || '').toLowerCase());
}