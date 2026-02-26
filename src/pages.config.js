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
import AdminPaymentAlerts from './pages/AdminPaymentAlerts';
import FAQ from './pages/FAQ';
import AccountDisabled from './pages/AccountDisabled';
import AdminRoles from './pages/AdminRoles';
import AccountingDashboard from './pages/AccountingDashboard';
import AdminMarketing from './pages/AdminMarketing';
import Home from './pages/Home';
import ShippingCalculator from './pages/ShippingCalculator';
import Dashboard from './pages/Dashboard';
import AdminPayments from './pages/AdminPayments';
import AdminInsured from './pages/AdminInsured';
import Support from './pages/Support';
import Profile from './pages/Profile';
import AdminPromotions from './pages/AdminPromotions';
import PreAlert from './pages/PreAlert';
import AdminEmailCampaigns from './pages/AdminEmailCampaigns';
import AdminFAQ from './pages/AdminFAQ';
import AdminConsolidate from './pages/AdminConsolidate';
import AdminShipmentApprovals from './pages/AdminShipmentApprovals';
import AdminPermissions from './pages/AdminPermissions';
import MyPackages from './pages/MyPackages';
import AdminEmailTemplates from './pages/AdminEmailTemplates';
import RequestConsolidation from './pages/RequestConsolidation';
import MyConsolidations from './pages/MyConsolidations';
import Rates from './pages/Rates';
import AdminDashboard from './pages/AdminDashboard';
import ShipmentTracking from './pages/ShipmentTracking';
import AdminClients from './pages/AdminClients';
import AdminInvoices from './pages/AdminInvoices';
import AdminSupportTickets from './pages/AdminSupportTickets';
import MyInvoices from './pages/MyInvoices';
import AdminSupport from './pages/AdminSupport';
import AdminPackages from './pages/AdminPackages';
import AdminSettings from './pages/AdminSettings';
import ClientPortal from './pages/ClientPortal';
import AdminReports from './pages/AdminReports';
import EmployeeDashboard from './pages/EmployeeDashboard';
import AdminDelete from './pages/AdminDelete';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminPaymentAlerts": AdminPaymentAlerts,
    "FAQ": FAQ,
    "AccountDisabled": AccountDisabled,
    "AdminRoles": AdminRoles,
    "AccountingDashboard": AccountingDashboard,
    "AdminMarketing": AdminMarketing,
    "Home": Home,
    "ShippingCalculator": ShippingCalculator,
    "Dashboard": Dashboard,
    "AdminPayments": AdminPayments,
    "AdminInsured": AdminInsured,
    "Support": Support,
    "Profile": Profile,
    "AdminPromotions": AdminPromotions,
    "PreAlert": PreAlert,
    "AdminEmailCampaigns": AdminEmailCampaigns,
    "AdminFAQ": AdminFAQ,
    "AdminConsolidate": AdminConsolidate,
    "AdminShipmentApprovals": AdminShipmentApprovals,
    "AdminPermissions": AdminPermissions,
    "MyPackages": MyPackages,
    "AdminEmailTemplates": AdminEmailTemplates,
    "RequestConsolidation": RequestConsolidation,
    "MyConsolidations": MyConsolidations,
    "Rates": Rates,
    "AdminDashboard": AdminDashboard,
    "ShipmentTracking": ShipmentTracking,
    "AdminClients": AdminClients,
    "AdminInvoices": AdminInvoices,
    "AdminSupportTickets": AdminSupportTickets,
    "MyInvoices": MyInvoices,
    "AdminSupport": AdminSupport,
    "AdminPackages": AdminPackages,
    "AdminSettings": AdminSettings,
    "ClientPortal": ClientPortal,
    "AdminReports": AdminReports,
    "EmployeeDashboard": EmployeeDashboard,
    "AdminDelete": AdminDelete,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};