import AdminClients from './pages/AdminClients';
import AdminConsolidate from './pages/AdminConsolidate';
import AdminDashboard from './pages/AdminDashboard';
import AdminInsured from './pages/AdminInsured';
import AdminPackages from './pages/AdminPackages';
import AdminPayments from './pages/AdminPayments';
import AdminPermissions from './pages/AdminPermissions';
import AdminSettings from './pages/AdminSettings';
import AdminSupport from './pages/AdminSupport';
import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import MyConsolidations from './pages/MyConsolidations';
import MyPackages from './pages/MyPackages';
import PreAlert from './pages/PreAlert';
import Rates from './pages/Rates';
import ShipmentTracking from './pages/ShipmentTracking';
import Support from './pages/Support';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminClients": AdminClients,
    "AdminConsolidate": AdminConsolidate,
    "AdminDashboard": AdminDashboard,
    "AdminInsured": AdminInsured,
    "AdminPackages": AdminPackages,
    "AdminPayments": AdminPayments,
    "AdminPermissions": AdminPermissions,
    "AdminSettings": AdminSettings,
    "AdminSupport": AdminSupport,
    "Dashboard": Dashboard,
    "Home": Home,
    "MyConsolidations": MyConsolidations,
    "MyPackages": MyPackages,
    "PreAlert": PreAlert,
    "Rates": Rates,
    "ShipmentTracking": ShipmentTracking,
    "Support": Support,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};