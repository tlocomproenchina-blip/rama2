import AdminClients from './pages/AdminClients';
import AdminConsolidate from './pages/AdminConsolidate';
import AdminDashboard from './pages/AdminDashboard';
import AdminInsured from './pages/AdminInsured';
import AdminPackages from './pages/AdminPackages';
import AdminPermissions from './pages/AdminPermissions';
import AdminSettings from './pages/AdminSettings';
import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import MyConsolidations from './pages/MyConsolidations';
import MyPackages from './pages/MyPackages';
import PreAlert from './pages/PreAlert';
import AdminPayments from './pages/AdminPayments';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminClients": AdminClients,
    "AdminConsolidate": AdminConsolidate,
    "AdminDashboard": AdminDashboard,
    "AdminInsured": AdminInsured,
    "AdminPackages": AdminPackages,
    "AdminPermissions": AdminPermissions,
    "AdminSettings": AdminSettings,
    "Dashboard": Dashboard,
    "Home": Home,
    "MyConsolidations": MyConsolidations,
    "MyPackages": MyPackages,
    "PreAlert": PreAlert,
    "AdminPayments": AdminPayments,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};