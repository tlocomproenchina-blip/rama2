import { useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import WarehouseReceive from './pages/WarehouseReceive';
import WarehouseLocations from './pages/WarehouseLocations';
import WarehouseDashboard from './pages/WarehouseDashboard';
import WarehousePickPackShip from './pages/WarehousePickPackShip';
import ClientAnalytics from './pages/ClientAnalytics';
import AdminAdministrators from './pages/AdminAdministrators';
import AdminRoles from './pages/AdminRoles';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

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
      <Route path="/WarehouseReceive" element={
        <LayoutWrapper currentPageName="WarehouseReceive">
          <WarehouseReceive />
        </LayoutWrapper>
      } />
      <Route path="/WarehouseLocations" element={
        <LayoutWrapper currentPageName="WarehouseLocations">
          <WarehouseLocations />
        </LayoutWrapper>
      } />
      <Route path="/WarehouseDashboard" element={
        <LayoutWrapper currentPageName="WarehouseDashboard">
          <WarehouseDashboard />
        </LayoutWrapper>
      } />
      <Route path="/WarehousePickPackShip" element={
        <LayoutWrapper currentPageName="WarehousePickPackShip">
          <WarehousePickPackShip />
        </LayoutWrapper>
      } />
      <Route path="/ClientAnalytics" element={
        <LayoutWrapper currentPageName="ClientAnalytics">
          <ClientAnalytics />
        </LayoutWrapper>
      } />
      <Route path="/AdminAdministrators" element={
        <LayoutWrapper currentPageName="AdminAdministrators">
          <AdminAdministrators />
        </LayoutWrapper>
      } />
      <Route path="/AdminRoles" element={
        <LayoutWrapper currentPageName="AdminRoles">
          <AdminRoles />
        </LayoutWrapper>
      } />
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