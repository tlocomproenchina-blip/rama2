/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AccountDisabled from './pages/AccountDisabled';
import AccountingDashboard from './pages/AccountingDashboard';
import AdminAccountsPayable from './pages/AdminAccountsPayable';
import AdminClients from './pages/AdminClients';
import AdminConsolidate from './pages/AdminConsolidate';
import AdminDelete from './pages/AdminDelete';
import AdminEmailCampaigns from './pages/AdminEmailCampaigns';
import AdminEmailTemplates from './pages/AdminEmailTemplates';
import AdminFAQ from './pages/AdminFAQ';
import AdminInsured from './pages/AdminInsured';
import AdminInvoices from './pages/AdminInvoices';
import AdminKnowledgeBase from './pages/AdminKnowledgeBase';
import AdminMarketing from './pages/AdminMarketing';
import AdminPackages from './pages/AdminPackages';
import AdminPaymentAlerts from './pages/AdminPaymentAlerts';
import AdminPayments from './pages/AdminPayments';
import AdminPermissions from './pages/AdminPermissions';
import AdminPromotions from './pages/AdminPromotions';
import AdminProviderPayments from './pages/AdminProviderPayments';
import AdminProviders from './pages/AdminProviders';
import AdminReports from './pages/AdminReports';
import AdminRoles from './pages/AdminRoles';
import AdminShipmentApprovals from './pages/AdminShipmentApprovals';
import AdminSupport from './pages/AdminSupport';
import AdminSupportTickets from './pages/AdminSupportTickets';
import BusinessDashboard from './pages/BusinessDashboard';
import ClientPortal from './pages/ClientPortal';
import Dashboard from './pages/Dashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';
import FAQ from './pages/FAQ';
import Home from './pages/Home';
import MyConsolidations from './pages/MyConsolidations';
import MyInvoices from './pages/MyInvoices';
import MyPackages from './pages/MyPackages';
import PreAlert from './pages/PreAlert';
import Profile from './pages/Profile';
import Rates from './pages/Rates';
import RequestConsolidation from './pages/RequestConsolidation';
import ShipmentTracking from './pages/ShipmentTracking';
import ShippingCalculator from './pages/ShippingCalculator';
import Support from './pages/Support';
import AdminDashboard from './pages/AdminDashboard';
import AdminSettings from './pages/AdminSettings';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AccountDisabled": AccountDisabled,
    "AccountingDashboard": AccountingDashboard,
    "AdminAccountsPayable": AdminAccountsPayable,
    "AdminClients": AdminClients,
    "AdminConsolidate": AdminConsolidate,
    "AdminDelete": AdminDelete,
    "AdminEmailCampaigns": AdminEmailCampaigns,
    "AdminEmailTemplates": AdminEmailTemplates,
    "AdminFAQ": AdminFAQ,
    "AdminInsured": AdminInsured,
    "AdminInvoices": AdminInvoices,
    "AdminKnowledgeBase": AdminKnowledgeBase,
    "AdminMarketing": AdminMarketing,
    "AdminPackages": AdminPackages,
    "AdminPaymentAlerts": AdminPaymentAlerts,
    "AdminPayments": AdminPayments,
    "AdminPermissions": AdminPermissions,
    "AdminPromotions": AdminPromotions,
    "AdminProviderPayments": AdminProviderPayments,
    "AdminProviders": AdminProviders,
    "AdminReports": AdminReports,
    "AdminRoles": AdminRoles,
    "AdminShipmentApprovals": AdminShipmentApprovals,
    "AdminSupport": AdminSupport,
    "AdminSupportTickets": AdminSupportTickets,
    "BusinessDashboard": BusinessDashboard,
    "ClientPortal": ClientPortal,
    "Dashboard": Dashboard,
    "EmployeeDashboard": EmployeeDashboard,
    "FAQ": FAQ,
    "Home": Home,
    "MyConsolidations": MyConsolidations,
    "MyInvoices": MyInvoices,
    "MyPackages": MyPackages,
    "PreAlert": PreAlert,
    "Profile": Profile,
    "Rates": Rates,
    "RequestConsolidation": RequestConsolidation,
    "ShipmentTracking": ShipmentTracking,
    "ShippingCalculator": ShippingCalculator,
    "Support": Support,
    "AdminDashboard": AdminDashboard,
    "AdminSettings": AdminSettings,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};