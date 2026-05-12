import { useEffect, lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

// Lazy-loaded admin / warehouse pages — reduce bundle inicial para clientes
const WarehouseReceive = lazy(() => import('./pages/WarehouseReceive'));
const WarehouseLocations = lazy(() => import('./pages/WarehouseLocations'));
const WarehouseDashboard = lazy(() => import('./pages/WarehouseDashboard'));
const WarehousePickPackShip = lazy(() => import('./pages/WarehousePickPackShip'));
const ClientAnalytics = lazy(() => import('./pages/ClientAnalytics'));
const AccountingDashboard = lazy(() => import('./pages/AccountingDashboard'));
const AdminEmployees = lazy(() => import('./pages/AdminEmployees'));
const AdminAdministrators = lazy(() => import('./pages/AdminAdministrators'));
const AdminRoles = lazy(() => import('./pages/AdminRoles'));
const AdminEmployeeAudit = lazy(() => import('./pages/AdminEmployeeAudit'));
const AdminEmployeePerformance = lazy(() => import('./pages/AdminEmployeePerformance'));
const AdminActivityAudit = lazy(() => import('./pages/AdminActivityAudit'));
const AdminVehiculos = lazy(() => import('./pages/AdminVehiculos'));
const AdminChoferes = lazy(() => import('./pages/AdminChoferes'));
const AdminRutas = lazy(() => import('./pages/AdminRutas'));
const AdminCargaRutas = lazy(() => import('./pages/AdminCargaRutas'));
const AdminSeguimientoRutas = lazy(() => import('./pages/AdminSeguimientoRutas'));
const AdminLogistica = lazy(() => import('./pages/AdminLogistica'));
const AdminOperaciones = lazy(() => import('./pages/AdminOperaciones'));
const AdminSeguimiento = lazy(() => import('./pages/AdminSeguimiento'));
const AdminRutaDetalle = lazy(() => import('./pages/AdminRutaDetalle'));
const AdminInternalMessages = lazy(() => import('./pages/AdminInternalMessages'));
const AdminCbmIngresos = lazy(() => import('./pages/AdminCbmIngresos'));
const AdminDuplicates = lazy(() => import('./pages/AdminDuplicates'));
const AdminRevenueDashboard = lazy(() => import('./pages/AdminRevenueDashboard'));
const AdminPreAlerts = lazy(() => import('./pages/AdminPreAlerts'));
const AdminSupportQuickMessages = lazy(() => import('./pages/AdminSupportQuickMessages'));
const AdminClients = lazy(() => import('./pages/AdminClients'));
const AdminInvoices = lazy(() => import('./pages/AdminInvoices'));
const AdminCreditUsage = lazy(() => import('./pages/AdminCreditUsage'));

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const RouteFallback = () => (
  <div className="flex items-center justify-center min-h-[40vh]">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

// Wrapper that receives `user` and `refreshUser` from Layout (via cloneElement)
// and forwards them to the lazy-loaded component.
const LazyPage = ({ Component, ...injectedProps }) => (
  <Suspense fallback={<RouteFallback />}>
    <Component {...injectedProps} />
  </Suspense>
);

const lazyRoute = (Component, name) => (
  <LayoutWrapper currentPageName={name}>
    <LazyPage Component={Component} />
  </LayoutWrapper>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  useEffect(() => {
    if (authError?.type === 'auth_required') {
      navigateToLogin();
    }
  }, [authError, navigateToLogin]);

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      {Pages.Dashboard && (
        <Route path="/ClientPortal" element={
          <LayoutWrapper currentPageName="Dashboard">
            <Pages.Dashboard />
          </LayoutWrapper>
        } />
      )}
      <Route path="/WarehouseReceive" element={lazyRoute(WarehouseReceive, "WarehouseReceive")} />
      <Route path="/WarehouseLocations" element={lazyRoute(WarehouseLocations, "WarehouseLocations")} />
      <Route path="/WarehouseDashboard" element={lazyRoute(WarehouseDashboard, "WarehouseDashboard")} />
      <Route path="/WarehousePickPackShip" element={lazyRoute(WarehousePickPackShip, "WarehousePickPackShip")} />
      <Route path="/ClientAnalytics" element={lazyRoute(ClientAnalytics, "ClientAnalytics")} />
      <Route path="/AccountingDashboard" element={lazyRoute(AccountingDashboard, "AccountingDashboard")} />
      <Route path="/AdminEmployees" element={lazyRoute(AdminEmployees, "AdminEmployees")} />
      <Route path="/AdminAdministrators" element={lazyRoute(AdminAdministrators, "AdminAdministrators")} />
      <Route path="/AdminRoles" element={lazyRoute(AdminRoles, "AdminRoles")} />
      <Route path="/AdminEmployeeAudit" element={lazyRoute(AdminEmployeeAudit, "AdminEmployeeAudit")} />
      <Route path="/AdminEmployeePerformance" element={lazyRoute(AdminEmployeePerformance, "AdminEmployeePerformance")} />
      <Route path="/AdminActivityAudit" element={lazyRoute(AdminActivityAudit, "AdminActivityAudit")} />
      <Route path="/AdminVehiculos" element={lazyRoute(AdminVehiculos, "AdminVehiculos")} />
      <Route path="/AdminChoferes" element={lazyRoute(AdminChoferes, "AdminChoferes")} />
      <Route path="/AdminRutas" element={lazyRoute(AdminRutas, "AdminRutas")} />
      <Route path="/AdminCargaRutas" element={lazyRoute(AdminCargaRutas, "AdminCargaRutas")} />
      <Route path="/AdminSeguimientoRutas" element={lazyRoute(AdminSeguimientoRutas, "AdminSeguimientoRutas")} />
      <Route path="/AdminLogistica" element={lazyRoute(AdminLogistica, "AdminLogistica")} />
      <Route path="/AdminOperaciones" element={lazyRoute(AdminOperaciones, "AdminOperaciones")} />
      <Route path="/AdminSeguimiento" element={lazyRoute(AdminSeguimiento, "AdminSeguimiento")} />
      <Route path="/AdminRutaDetalle" element={lazyRoute(AdminRutaDetalle, "AdminRutaDetalle")} />
      <Route path="/AdminInternalMessages" element={lazyRoute(AdminInternalMessages, "AdminInternalMessages")} />
      <Route path="/AdminCbmIngresos" element={lazyRoute(AdminCbmIngresos, "AdminCbmIngresos")} />
      <Route path="/AdminDuplicates" element={lazyRoute(AdminDuplicates, "AdminDuplicates")} />
      <Route path="/AdminRevenueDashboard" element={lazyRoute(AdminRevenueDashboard, "AdminRevenueDashboard")} />
      <Route path="/AdminPreAlerts" element={lazyRoute(AdminPreAlerts, "AdminPreAlerts")} />
      <Route path="/AdminSupportQuickMessages" element={lazyRoute(AdminSupportQuickMessages, "AdminSupportQuickMessages")} />
      <Route path="/AdminClients" element={lazyRoute(AdminClients, "AdminClients")} />
      <Route path="/AdminInvoices" element={lazyRoute(AdminInvoices, "AdminInvoices")} />
      <Route path="/AdminCreditUsage" element={lazyRoute(AdminCreditUsage, "AdminCreditUsage")} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App