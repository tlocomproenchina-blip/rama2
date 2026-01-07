import AdminClients from './pages/AdminClients';
import AdminDashboard from './pages/AdminDashboard';
import AdminInsured from './pages/AdminInsured';
import AdminPermissions from './pages/AdminPermissions';
import AdminSettings from './pages/AdminSettings';
import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import MyConsolidations from './pages/MyConsolidations';
import MyPackages from './pages/MyPackages';
import PreAlert from './pages/PreAlert';
import AdminPayments from './pages/AdminPayments';
import AdminConsolidate from './pages/AdminConsolidate';
import AdminPackages from './pages/AdminPackages';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminClients": AdminClients,
    "AdminDashboard": AdminDashboard,
    "AdminInsured": AdminInsured,
    "AdminPermissions": AdminPermissions,
    "AdminSettings": AdminSettings,
    "Dashboard": Dashboard,
    "Home": Home,
    "MyConsolidations": MyConsolidations,
    "MyPackages": MyPackages,
    "PreAlert": PreAlert,
    "AdminPayments": AdminPayments,
    "AdminConsolidate": AdminConsolidate,
    "AdminPackages": AdminPackages,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};