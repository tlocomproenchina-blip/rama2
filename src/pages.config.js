import Dashboard from './pages/Dashboard';
import PreAlert from './pages/PreAlert';
import MyPackages from './pages/MyPackages';
import MyConsolidations from './pages/MyConsolidations';
import AdminDashboard from './pages/AdminDashboard';
import AdminPackages from './pages/AdminPackages';
import AdminConsolidate from './pages/AdminConsolidate';
import AdminPayments from './pages/AdminPayments';
import AdminClients from './pages/AdminClients';
import AdminInsured from './pages/AdminInsured';
import AdminPermissions from './pages/AdminPermissions';
import AdminSettings from './pages/AdminSettings';
import Home from './pages/Home';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "PreAlert": PreAlert,
    "MyPackages": MyPackages,
    "MyConsolidations": MyConsolidations,
    "AdminDashboard": AdminDashboard,
    "AdminPackages": AdminPackages,
    "AdminConsolidate": AdminConsolidate,
    "AdminPayments": AdminPayments,
    "AdminClients": AdminClients,
    "AdminInsured": AdminInsured,
    "AdminPermissions": AdminPermissions,
    "AdminSettings": AdminSettings,
    "Home": Home,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};