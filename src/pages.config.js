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
import AdminClients from './pages/AdminClients';
import AdminConsolidate from './pages/AdminConsolidate';
import AdminDashboard from './pages/AdminDashboard';
import AdminDelete from './pages/AdminDelete';
import AdminFAQ from './pages/AdminFAQ';
import AdminInsured from './pages/AdminInsured';
import AdminInvoices from './pages/AdminInvoices';
import AdminPackages from './pages/AdminPackages';
import AdminPaymentAlerts from './pages/AdminPaymentAlerts';
import AdminPayments from './pages/AdminPayments';
import AdminPermissions from './pages/AdminPermissions';
import AdminReports from './pages/AdminReports';
import AdminSettings from './pages/AdminSettings';
import AdminSupport from './pages/AdminSupport';
import AdminSupportTickets from './pages/AdminSupportTickets';
import Dashboard from './pages/Dashboard';
import FAQ from './pages/FAQ';
import Home from './pages/Home';
import MyConsolidations from './pages/MyConsolidations';
import MyInvoices from './pages/MyInvoices';
import MyPackages from './pages/MyPackages';
import PreAlert from './pages/PreAlert';
import Rates from './pages/Rates';
import ShipmentTracking from './pages/ShipmentTracking';
import ShippingCalculator from './pages/ShippingCalculator';
import Support from './pages/Support';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminClients": AdminClients,
    "AdminConsolidate": AdminConsolidate,
    "AdminDashboard": AdminDashboard,
    "AdminDelete": AdminDelete,
    "AdminFAQ": AdminFAQ,
    "AdminInsured": AdminInsured,
    "AdminInvoices": AdminInvoices,
    "AdminPackages": AdminPackages,
    "AdminPaymentAlerts": AdminPaymentAlerts,
    "AdminPayments": AdminPayments,
    "AdminPermissions": AdminPermissions,
    "AdminReports": AdminReports,
    "AdminSettings": AdminSettings,
    "AdminSupport": AdminSupport,
    "AdminSupportTickets": AdminSupportTickets,
    "Dashboard": Dashboard,
    "FAQ": FAQ,
    "Home": Home,
    "MyConsolidations": MyConsolidations,
    "MyInvoices": MyInvoices,
    "MyPackages": MyPackages,
    "PreAlert": PreAlert,
    "Rates": Rates,
    "ShipmentTracking": ShipmentTracking,
    "ShippingCalculator": ShippingCalculator,
    "Support": Support,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};