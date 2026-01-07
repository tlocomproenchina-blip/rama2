import Dashboard from './pages/Dashboard';
import PreAlert from './pages/PreAlert';
import MyPackages from './pages/MyPackages';
import MyConsolidations from './pages/MyConsolidations';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "PreAlert": PreAlert,
    "MyPackages": MyPackages,
    "MyConsolidations": MyConsolidations,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};