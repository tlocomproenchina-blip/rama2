import {
  Home, Package, Layers, Warehouse, Truck, Wallet, Building2, Users, Megaphone,
  Headphones, ShieldCheck, Settings, LayoutDashboard, CreditCard, Calculator,
  HelpCircle, UserCircle,
} from 'lucide-react';

const p = (page, label) => ({ page, label });

// Secciones del panel admin: cada página del menú (adminMenuItems) está en
// exactamente una sección. subPages son pantallas que no van en pestañas pero
// resaltan su sección cuando se abren desde otra.
export const ADMIN_SECTIONS = [
  { id: 'inicio', label: 'Inicio', icon: Home, pages: [
    p('AdminDashboard', 'Resumen'), p('AdminOperaciones', 'Operaciones'), p('WarehouseDashboard', 'Almacén'),
    p('AccountingDashboard', 'Contabilidad'), p('AdminRevenueDashboard', 'Ingresos'), p('AdminSeguimiento', 'Seguimiento'),
    p('AdminDailySummary', 'Resumen diario'),
  ] },
  { id: 'envios', label: 'Envíos', icon: Package, pages: [
    p('AdminPackages', 'Paquetes'), p('AdminPreAlerts', 'Pre-alertas'), p('AdminOrphanPackages', 'Huérfanos'),
    p('AdminDuplicates', 'Duplicados'), p('AdminInsured', 'Asegurados'), p('AdminArrivalCalendar', 'Llegadas'),
    p('AdminCbmIngresos', 'CBM China'), p('ShipmentTracking', 'Seguimiento'), p('ShippingCalculator', 'Calculadora'),
  ] },
  { id: 'consolidacion', label: 'Consolidación', icon: Layers, pages: [
    p('AdminConsolidate', 'Aprobar'), p('AdminShipmentApprovals', 'Consolidar'), p('AdminContainersReport', 'Contenedores por cliente'),
  ] },
  { id: 'almacen', label: 'Almacén', icon: Warehouse, pages: [
    p('WarehouseReceive', 'Recepción'), p('WarehouseLocations', 'Ubicaciones'), p('WarehousePickPackShip', 'Picking'),
    p('WarehouseScanPack', 'Mesa de empaque'), p('WarehouseBultos', 'Bultos'), p('WarehouseDispatch', 'Despacho'),
    p('WarehouseDispatchHistory', 'Historial de despachos'), p('DispatchLabels', 'Etiquetas'), p('DispatchGuides', 'Guías'),
  ], subPages: ['AdminDispatchOrders'] },
  { id: 'rutas', label: 'Rutas', icon: Truck, pages: [
    p('AdminLogistica', 'Logística'), p('AdminVehiculos', 'Vehículos'), p('AdminChoferes', 'Choferes'),
    p('AdminRutas', 'Rutas'), p('AdminCargaRutas', 'Cargas'), p('AdminSeguimientoRutas', 'Seguimiento de rutas'),
  ], subPages: ['AdminRutaDetalle'] },
  { id: 'finanzas', label: 'Finanzas', icon: Wallet, pages: [
    p('AdminInvoices', 'Facturas'), p('AdminManualBilling', 'Facturación manual'), p('AdminQuotes', 'Presupuestos'),
    p('AdminPayments', 'Validar pagos'), p('AdminAssistedPayments', 'Pagos asistidos'), p('AdminClientCredits', 'Saldo cliente'),
    p('AdminPaymentAlerts', 'Alertas de pago'),
  ] },
  { id: 'proveedores', label: 'Proveedores', icon: Building2, pages: [
    p('AdminProviders', 'Proveedores'), p('AdminAccountsPayable', 'Cuentas por pagar'), p('AdminProviderPayments', 'Pagos'),
    p('AdminProviderCredits', 'Saldo proveedor'),
  ] },
  { id: 'clientes', label: 'Clientes', icon: Users, pages: [
    p('AdminClients', 'Clientes'), p('AdminWholesalerClients', 'Mayoristas'), p('AdminSharedPortal', 'Portal compartido'),
    p('AdminReferrals', 'Referidos'), p('ClientAnalytics', 'Análisis'), p('AdminSupportCollections', 'Cobranza'),
  ] },
  { id: 'marketing', label: 'Marketing', icon: Megaphone, pages: [
    p('AdminEmailCampaigns', 'Enviar emails'), p('AdminDeliveryProofCampaign', 'Comprobantes de entrega'), p('AdminEmailHistory', 'Historial'),
    p('AdminEmailTemplates', 'Plantillas'), p('AdminPromotions', 'Promociones'), p('AdminMarketing', 'Marketing'),
    p('AdminCityAnalytics', 'Ciudades'), p('AdminBlog', 'Blog'),
  ] },
  { id: 'soporte', label: 'Soporte', icon: Headphones, pages: [
    p('AdminSupportAssistant', 'Asistente ATC'), p('AdminSupportSupervisor', 'Supervisor'), p('AdminSupportTickets', 'Tickets'),
    p('AdminSupportQuickMessages', 'Mensajes rápidos'), p('AdminAssistantKnowledge', 'Conocimiento del asistente'),
    p('AdminInternalMessages', 'Mensajería interna'), p('AdminFAQ', 'FAQ'), p('AdminKnowledgeBase', 'Base de conocimiento'),
  ], subPages: ['AdminSupport', 'AdminSupportClients'] },
  { id: 'control', label: 'Control', icon: ShieldCheck, pages: [
    p('AdminBodegaProductividad', 'Productividad'), p('AdminBultoAudit', 'Auditoría de bultos'), p('WarehousePrintAudit', 'Auditoría de impresiones'),
    p('WarehouseDispatchScanHistory', 'Historial de escaneos'), p('AdminWarehouseIncidents', 'Incidencias'), p('AdminDispositivosBodega', 'Dispositivos'),
    p('AdminActivityAudit', 'Auditoría de actividad'), p('AdminEmployeeAudit', 'Auditoría de acciones'), p('AdminEmployeePerformance', 'Rendimiento de empleados'),
  ], subPages: ['AdminCreditUsage'] },
  { id: 'configuracion', label: 'Configuración', icon: Settings, pages: [
    p('AdminSettings', 'Ajustes'), p('AdminEmployees', 'Empleados'), p('AdminAdministrators', 'Administradores'),
    p('AdminRoles', 'Roles'), p('AdminDelete', 'Eliminar'),
  ] },
];

export const CLIENT_SECTIONS = [
  { id: 'c-inicio', label: 'Inicio', icon: LayoutDashboard, pages: [p('Dashboard', 'Dashboard')] },
  { id: 'c-envios', label: 'Mis envíos', icon: Package, pages: [
    p('MyPackages', 'Paquetes'), p('MyWarehouseMerchandise', 'Almacén Venezuela'), p('MyCbm', 'Mis CBM'),
    p('PreAlert', 'Pre-alerta'), p('RequestConsolidation', 'Solicitar consolidación'),
  ], subPages: ['MyConsolidations'] },
  { id: 'c-facturas', label: 'Facturas y pagos', icon: CreditCard, pages: [p('MyInvoices', 'Mis facturas'), p('AssistedPayment', 'Pago asistido')] },
  { id: 'c-seguimiento', label: 'Seguimiento', icon: Truck, pages: [p('ShipmentTracking', 'Seguimiento')] },
  { id: 'c-cotizar', label: 'Cotizar', icon: Calculator, pages: [p('ShippingCalculator', 'Calculadora'), p('Rates', 'Tarifas')] },
  { id: 'c-ayuda', label: 'Ayuda', icon: HelpCircle, pages: [p('FAQ', 'FAQ'), p('Support', 'Soporte'), p('Contract', 'Contrato')] },
  { id: 'c-cuenta', label: 'Mi cuenta', icon: UserCircle, pages: [p('Profile', 'Perfil'), p('MyReferrals', 'Referidos')] },
];

// Secciones con solo las páginas que el usuario puede abrir; sin páginas, no aparece.
export function filterSections(sections, visiblePages) {
  const allowed = new Set(visiblePages);
  return sections
    .map((s) => ({ ...s, pages: s.pages.filter((x) => allowed.has(x.page)) }))
    .filter((s) => s.pages.length > 0);
}

export function findSection(sections, page) {
  if (!page) return null;
  return sections.find((s) => s.pages.some((x) => x.page === page) || (s.subPages || []).includes(page)) || null;
}

const LAST_TAB_KEY = 'tlec-last-section-tab';
export function getLastTab(sectionId) {
  try { return JSON.parse(localStorage.getItem(LAST_TAB_KEY) || '{}')[sectionId] || null; } catch (_) { return null; }
}
export function setLastTab(sectionId, page) {
  try {
    const all = JSON.parse(localStorage.getItem(LAST_TAB_KEY) || '{}');
    all[sectionId] = page;
    localStorage.setItem(LAST_TAB_KEY, JSON.stringify(all));
  } catch (_) {}
}

// Página a la que lleva una sección: la última pestaña visitada o la primera.
export function sectionTarget(section) {
  const last = getLastTab(section.id);
  return section.pages.some((x) => x.page === last) ? last : section.pages[0].page;
}