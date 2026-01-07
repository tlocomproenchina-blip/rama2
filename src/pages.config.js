import Dashboard from './pages/Dashboard';
import PreAlert from './pages/PreAlert';
import MyPackages from './pages/MyPackages';
import MyConsolidations from './pages/MyConsolidations';
import AdminDashboard from './pages/AdminDashboard';
import AdminPackages from './pages/AdminPackages';
import AdminConsolidate from './pages/AdminConsolidate';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "PreAlert": PreAlert,
    "MyPackages": MyPackages,
    "MyConsolidations": MyConsolidations,
    "AdminDashboard": AdminDashboard,
    "AdminPackages": AdminPackages,
    "AdminConsolidate": AdminConsolidate,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};