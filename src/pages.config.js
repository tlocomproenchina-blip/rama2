/**
 * pages.config.js - Page routing configuration
 *
 * IMPORTANTE: todas las páginas se cargan de forma diferida (lazy) para que el
 * navegador solo descargue el código de la página que el usuario realmente
 * visita. Antes se importaban las ~68 páginas de golpe, lo que obligaba a
 * descargar y ejecutar todo el panel de administración incluso para un cliente
 * o un visitante anónimo.
 *
 * THE ONLY EDITABLE VALUE: mainPage
 */
import { lazy } from 'react';
import __Layout from './Layout.jsx';

export const PAGES = {
    "AccountDisabled": lazy(() => import('./pages/AccountDisabled')),
    "AccountingDashboard": lazy(() => import('./pages/AccountingDashboard')),
    "AdminAccountsPayable": lazy(() => import('./pages/AdminAccountsPayable')),
    "AdminActivityAudit": lazy(() => import('./pages/AdminActivityAudit')),
    "AdminAdministrators": lazy(() => import('./pages/AdminAdministrators')),
    "AdminAssistedPayments": lazy(() => import('./pages/AdminAssistedPayments')),
    "AdminBlog": lazy(() => import('./pages/AdminBlog')),
    "AdminCargaRutas": lazy(() => import('./pages/AdminCargaRutas')),
    "AdminChoferes": lazy(() => import('./pages/AdminChoferes')),
    "AdminConsolidate": lazy(() => import('./pages/AdminConsolidate')),
    "AdminDashboard": lazy(() => import('./pages/AdminDashboard')),
    "AdminDelete": lazy(() => import('./pages/AdminDelete')),
    "AdminEmailCampaigns": lazy(() => import('./pages/AdminEmailCampaigns')),
    "AdminEmailTemplates": lazy(() => import('./pages/AdminEmailTemplates')),
    "AdminEmployeeAudit": lazy(() => import('./pages/AdminEmployeeAudit')),
    "AdminEmployeePerformance": lazy(() => import('./pages/AdminEmployeePerformance')),
    "AdminEmployees": lazy(() => import('./pages/AdminEmployees')),
    "AdminFAQ": lazy(() => import('./pages/AdminFAQ')),
    "AdminInsured": lazy(() => import('./pages/AdminInsured')),
    "AdminInternalMessages": lazy(() => import('./pages/AdminInternalMessages')),
    "AdminKnowledgeBase": lazy(() => import('./pages/AdminKnowledgeBase')),
    "AdminLogistica": lazy(() => import('./pages/AdminLogistica')),
    "AdminMarketing": lazy(() => import('./pages/AdminMarketing')),
    "AdminOperaciones": lazy(() => import('./pages/AdminOperaciones')),
    "AdminPackages": lazy(() => import('./pages/AdminPackages')),
    "AdminPaymentAlerts": lazy(() => import('./pages/AdminPaymentAlerts')),
    "AdminPreAlerts": lazy(() => import('./pages/AdminPreAlerts')),
    "AdminPayments": lazy(() => import('./pages/AdminPayments')),
    "AdminPromotions": lazy(() => import('./pages/AdminPromotions')),
    "AdminProviderPayments": lazy(() => import('./pages/AdminProviderPayments')),
    "AdminProviders": lazy(() => import('./pages/AdminProviders')),
    "AdminReferrals": lazy(() => import('./pages/AdminReferrals')),
    "AdminRoles": lazy(() => import('./pages/AdminRoles')),
    "AdminRutaDetalle": lazy(() => import('./pages/AdminRutaDetalle')),
    "AdminRutas": lazy(() => import('./pages/AdminRutas')),
    "AdminSeguimiento": lazy(() => import('./pages/AdminSeguimiento')),
    "AdminSeguimientoRutas": lazy(() => import('./pages/AdminSeguimientoRutas')),
    "AdminSettings": lazy(() => import('./pages/AdminSettings')),
    "AdminShipmentApprovals": lazy(() => import('./pages/AdminShipmentApprovals')),
    "AdminSupport": lazy(() => import('./pages/AdminSupport')),
    "AdminSupportTickets": lazy(() => import('./pages/AdminSupportTickets')),
    "AdminVehiculos": lazy(() => import('./pages/AdminVehiculos')),
    "AssistedPayment": lazy(() => import('./pages/AssistedPayment')),
    "Blog": lazy(() => import('./pages/Blog')),
    "BlogPost": lazy(() => import('./pages/BlogPost')),
    "ClientAnalytics": lazy(() => import('./pages/ClientAnalytics')),
    "Dashboard": lazy(() => import('./pages/Dashboard')),
    "FAQ": lazy(() => import('./pages/FAQ')),
    "Home": lazy(() => import('./pages/Home')),
    "MyCbm": lazy(() => import('./pages/MyCbm')),
    "MyConsolidations": lazy(() => import('./pages/MyConsolidations')),
    "MyInvoices": lazy(() => import('./pages/MyInvoices')),
    "MyPackages": lazy(() => import('./pages/MyPackages')),
    "MyReferrals": lazy(() => import('./pages/MyReferrals')),
    "PaypalReturn": lazy(() => import('./pages/PaypalReturn')),
    "PreAlert": lazy(() => import('./pages/PreAlert')),
    "Profile": lazy(() => import('./pages/Profile')),
    "Rates": lazy(() => import('./pages/Rates')),
    "RequestConsolidation": lazy(() => import('./pages/RequestConsolidation')),
    "ShipmentTracking": lazy(() => import('./pages/ShipmentTracking')),
    "ShippingCalculator": lazy(() => import('./pages/ShippingCalculator')),
    "Support": lazy(() => import('./pages/Support')),
    "TermsOfService": lazy(() => import('./pages/TermsOfService')),
    "WarehouseDashboard": lazy(() => import('./pages/WarehouseDashboard')),
    "WarehouseLocations": lazy(() => import('./pages/WarehouseLocations')),
    "WarehousePickPackShip": lazy(() => import('./pages/WarehousePickPackShip')),
    "WarehouseReceive": lazy(() => import('./pages/WarehouseReceive')),
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};