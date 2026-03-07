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
import AdminAssistedPayments from './pages/AdminAssistedPayments';
import AdminBlog from './pages/AdminBlog';
import AdminClients from './pages/AdminClients';
import AdminConsolidate from './pages/AdminConsolidate';
import AdminDashboard from './pages/AdminDashboard';
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
import AdminReferrals from './pages/AdminReferrals';
import AdminReports from './pages/AdminReports';
import AdminRoles from './pages/AdminRoles';
import AdminSettings from './pages/AdminSettings';
import AdminShipmentApprovals from './pages/AdminShipmentApprovals';
import AdminSupport from './pages/AdminSupport';
import AdminSupportTickets from './pages/AdminSupportTickets';
import AssistedPayment from './pages/AssistedPayment';
import Blog from './pages/Blog';
import BlogPost from './pages/BlogPost';
import BusinessDashboard from './pages/BusinessDashboard';
import ClientPortal from './pages/ClientPortal';
import Dashboard from './pages/Dashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';
import FAQ from './pages/FAQ';
import Home from './pages/Home';
import MyConsolidations from './pages/MyConsolidations';
import MyInvoices from './pages/MyInvoices';
import MyPackages from './pages/MyPackages';
import MyReferrals from './pages/MyReferrals';
import PreAlert from './pages/PreAlert';
import Profile from './pages/Profile';
import Rates from './pages/Rates';
import RequestConsolidation from './pages/RequestConsolidation';
import ShipmentTracking from './pages/ShipmentTracking';
import ShippingCalculator from './pages/ShippingCalculator';
import Support from './pages/Support';
import TermsOfService from './pages/TermsOfService';
import Register from './pages/Register';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AccountDisabled": AccountDisabled,
    "AccountingDashboard": AccountingDashboard,
    "AdminAccountsPayable": AdminAccountsPayable,
    "AdminAssistedPayments": AdminAssistedPayments,
    "AdminBlog": AdminBlog,
    "AdminClients": AdminClients,
    "AdminConsolidate": AdminConsolidate,
    "AdminDashboard": AdminDashboard,
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
    "AdminReferrals": AdminReferrals,
    "AdminReports": AdminReports,
    "AdminRoles": AdminRoles,
    "AdminSettings": AdminSettings,
    "AdminShipmentApprovals": AdminShipmentApprovals,
    "AdminSupport": AdminSupport,
    "AdminSupportTickets": AdminSupportTickets,
    "AssistedPayment": AssistedPayment,
    "Blog": Blog,
    "BlogPost": BlogPost,
    "BusinessDashboard": BusinessDashboard,
    "ClientPortal": ClientPortal,
    "Dashboard": Dashboard,
    "EmployeeDashboard": EmployeeDashboard,
    "FAQ": FAQ,
    "Home": Home,
    "MyConsolidations": MyConsolidations,
    "MyInvoices": MyInvoices,
    "MyPackages": MyPackages,
    "MyReferrals": MyReferrals,
    "PreAlert": PreAlert,
    "Profile": Profile,
    "Rates": Rates,
    "RequestConsolidation": RequestConsolidation,
    "ShipmentTracking": ShipmentTracking,
    "ShippingCalculator": ShippingCalculator,
    "Support": Support,
    "TermsOfService": TermsOfService,
    "Register": Register,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};