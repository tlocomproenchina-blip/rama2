import React, { useState, useEffect, Suspense, lazy } from 'react';
import { base44, setApiTuning } from '@/components/api/ApiQueueManager';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import Sidebar from '@/components/Sidebar';








import { notifyAdmins } from '@/components/NotificationUtils';
import { Menu, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Toaster } from 'sonner';
import GlobalErrorListener from '@/components/common/GlobalErrorListener';
import ErrorBoundary from '@/components/common/ErrorBoundary';

// Lazy loaded non-critical components
const NotificationCenter = lazy(() => import('@/components/NotificationCenter.jsx'));
const AdminNotificationCenter = lazy(() => import('@/components/AdminNotificationCenter.jsx'));
const WhatsAppSupport = lazy(() => import('@/components/WhatsAppSupport'));
const ChatbotAssistant = lazy(() => import('@/components/ChatbotAssistant'));
const PWAInstallPrompt = lazy(() => import('@/components/PWAInstallPrompt'));
const ContractModal = lazy(() => import('@/components/ContractModal.jsx'));
const ProfileSetupModal = lazy(() => import('@/components/ProfileSetupModal'));
const ApiStatusIndicator = lazy(() => import('@/components/api/ApiStatusIndicator'));
const MaintenanceScreen = lazy(() => import('@/components/MaintenanceScreen'));

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showContract, setShowContract] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [isInstalledApp, setIsInstalledApp] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminPanel = user?.role === 'admin';
  const showBackButton = ['ShippingCalculator', 'Rates', 'Blog', 'BlogPost'].includes(currentPageName);

  // Mobile tab navigation mappings
  const userTabDefaults = {
    home: 'ClientPortal',
    packages: 'MyPackages',
    invoices: 'MyInvoices',
    support: 'Support',
  };
  const adminTabDefaults = {
    home: 'AdminDashboard',
    packages: 'AdminPackages',
    invoices: 'AdminInvoices',
    support: 'AdminSupport',
  };

  const getTabKeyForPage = (pageName) => {
    if (!pageName) return null;
    const mapUser = {
      home: ['ClientPortal', 'Home', 'Dashboard'],
      packages: ['MyPackages', 'PreAlert', 'ShipmentTracking', 'RequestConsolidation', 'MyConsolidations'],
      invoices: ['MyInvoices'],
      support: ['Support'],
    };
    const mapAdmin = {
      home: ['AdminDashboard'],
      packages: ['AdminPackages', 'AdminShipmentApprovals'],
      invoices: ['AdminInvoices', 'AdminPayments', 'AdminPaymentAlerts'],
      support: ['AdminSupport', 'AdminSupportTickets'],
    };
    const maps = (user?.role === 'admin') ? mapAdmin : mapUser;
    for (const [key, pages] of Object.entries(maps)) {
      if (pages.includes(pageName)) return key;
    }
    return null;
  };

  const goToTab = (key) => {
    const defaults = (user?.role === 'admin') ? adminTabDefaults : userTabDefaults;
    const storageKey = `tab:lastRoute:${user?.role || 'user'}:${key}`;
    const saved = sessionStorage.getItem(storageKey);
    const target = saved || createPageUrl(defaults[key]);
    navigate(target);
  };

  // Persist last route per tab (simple stack preservation)
  useEffect(() => {
    const key = getTabKeyForPage(currentPageName);
    if (!key) return;
    const storageKey = `tab:lastRoute:${user?.role || 'user'}:${key}`;
    sessionStorage.setItem(storageKey, window.location.pathname + window.location.search);
  }, [currentPageName, location.key]);

  useEffect(() => {
    loadUser();
    loadConfig();
    loadFavicon();
  }, []);

  // Ajuste de rate-limit y concurrencia (modo 300+ usuarios concurrentes)
  useEffect(() => {
    setApiTuning({
      maxReads: 48,
      maxWrites: 16,
      minIntervalMs: 40,
      backoffDelays: [500, 1000, 2000, 4000, 8000],
      circuitBreakerThreshold: 20,
      circuitOpenMinutes: 1
    });
  }, []);

  // Detect if running as installed PWA (standalone)
  useEffect(() => {
    try {
      const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || (window.navigator && window.navigator.standalone === true);
      setIsInstalledApp(!!isStandalone);
    } catch (_) {
      setIsInstalledApp(false);
    }
  }, []);

  // Close any open Radix overlays (Select/Popover/Dropdown) on route change to avoid iOS removeChild crashes
  useEffect(() => {
    try {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    } catch {}
  }, [location.pathname, location.key]);

  const loadConfig = async () => {
    try {
      const configs = await base44.entities.AppConfig.filter({ config_key: 'main' });
      if (configs.length > 0) {
        setConfig(configs[0]);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  };

  const loadFavicon = async () => {
    try {
      const configs = await base44.entities.AppConfig.filter({ config_key: 'main' });
      if (configs.length > 0) {
        const faviconUrl = configs[0].favicon_url || configs[0].app_logo_url;
        if (faviconUrl) {
          const link = document.querySelector("link[rel='icon']") || document.createElement('link');
          link.rel = 'icon';
          link.href = faviconUrl;
          link.type = faviconUrl.endsWith('.ico') ? 'image/x-icon' : 'image/png';
          document.head.appendChild(link);
        }
      }
    } catch (error) {
      console.error('Error loading favicon:', error);
    }
  };

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Handle referral code in URL (e.g., ?ref=TLEC-XXXXXX)
      try {
        const params = new URLSearchParams(window.location.search);
        const ref = params.get('ref');
        if (ref) {
          await base44.functions.invoke('setReferralByCode', { code: ref });
        }
      } catch (_) {}

      // Auto-generate referral_code for approved clients if missing
      if (currentUser && currentUser.role === 'user' && !currentUser.referral_code) {
        const prefix = 'TLEC-';
        const rand = Array.from({ length: 8 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('');
        const code = (prefix + rand).toUpperCase();
        try { await base44.auth.updateMe({ referral_code: code }); } catch (_) {}
      }

      // Auto-create Stripe customer if missing
      if (currentUser && !currentUser.stripe_customer_id) {
        // Non-blocking call
        base44.functions.invoke('createStripeCustomer', {});
      }

      // Block access for inactive clients
      if (currentUser.role === 'user' && currentUser.is_active === false) {
        navigate(createPageUrl('AccountDisabled'));
        setLoading(false);
        return;
      }

      // Redirect admin to admin dashboard (except when on Home)
      if (currentUser.role === 'admin' && (!currentPageName || currentPageName === 'Dashboard')) {
        navigate(createPageUrl('AdminDashboard'));
        setLoading(false);
        return;
      }

      // Redirect custom role users to their dashboard (except when on Home)
      if (currentUser.custom_role && (!currentPageName || currentPageName === 'Dashboard')) {
        const roleConfigs = await base44.entities.RoleConfig.filter({ 
          role_code: currentUser.custom_role,
          is_active: true
        });
        
        if (roleConfigs.length > 0) {
          const visiblePages = roleConfigs[0].visible_pages || [];
          
          // Redirect to specialized dashboard for accounting role
          if (currentUser.custom_role === 'accounting') {
            navigate(createPageUrl('AccountingDashboard'));
            setLoading(false);
            return;
          } else if (visiblePages.includes('AdminDashboard')) {
            navigate(createPageUrl('AdminDashboard'));
            setLoading(false);
            return;
          } else if (visiblePages.includes('EmployeeDashboard')) {
            navigate(createPageUrl('EmployeeDashboard'));
            setLoading(false);
            return;
          }
        }
      }

      // Check contract and profile for regular users
      if (currentUser.role === 'user') {
        if (!currentUser.contract_accepted) {
          setShowContract(true);
          setLoading(false);
          return;
        } else if (!currentUser.profile_completed) {
          setShowProfile(true);
          setLoading(false);
          return;
        } else {
          // Check for missing fields and redirect to profile
          const missingFields = [];
          if (!currentUser.first_name) missingFields.push('first_name');
          if (!currentUser.last_name) missingFields.push('last_name');
          if (!currentUser.phone) missingFields.push('phone');
          if (!currentUser.whatsapp) missingFields.push('whatsapp');
          if (!currentUser.state) missingFields.push('state');
          if (!currentUser.city) missingFields.push('city');
          if (!currentUser.address) missingFields.push('address');
          
          if (missingFields.length > 0 && (!currentPageName || currentPageName === 'Home' || currentPageName === 'Dashboard')) {
            navigate(createPageUrl('Profile'));
            setLoading(false);
            return;
          }
        }
      }
      
      setLoading(false);
    } catch (error) {
      // Not logged in - if maintenance is ON, show maintenance instead of redirecting
      try {
        const configs = await base44.entities.AppConfig.filter({ config_key: 'main' });
        const cfg = configs[0];
        if (cfg?.maintenance_mode) {
          setConfig(cfg);
          setUser(null);
          setLoading(false);
          return;
        }
      } catch (_) {}
      // Allow specific public pages without login
      const publicPages = ['Home', 'ShippingCalculator', 'Blog', 'BlogPost'];
      if (publicPages.includes(currentPageName)) {
        setUser(null);
        setLoading(false);
        return;
      }
      // Otherwise require login
      base44.auth.redirectToLogin();
      setLoading(false);
    }
  };

  const handleContractAccept = async () => {
    await base44.auth.updateMe({
      contract_accepted: true,
      contract_accepted_date: new Date().toISOString()
    });
    setShowContract(false);
    setUser({ ...user, contract_accepted: true });
    
    if (!user.profile_completed) {
      setShowProfile(true);
    }
  };

  const handleContractReject = () => {
    base44.auth.logout();
  };

  const handleProfileComplete = async (profileData) => {
    try {
      await base44.auth.updateMe({
        ...profileData,
        profile_completed: true
      });
      setShowProfile(false);
      const updatedUser = { ...user, ...profileData, profile_completed: true };
      setUser(updatedUser);

      // Notify admins
      notifyAdmins({
        subject: '👤 Nuevo usuario registrado',
        body: `Un nuevo usuario ha completado su registro:\n\nNombre: ${profileData.first_name} ${profileData.last_name}\nCiudad: ${profileData.city}\nWhatsApp: ${profileData.whatsapp}\nEmail: ${user.email}\n\nPor favor asigna un Shipping Mark al usuario desde el panel de Clientes.`,
        message: `${profileData.first_name} ${profileData.last_name} (${user.email}) completó su registro`,
        type: 'general',
        icon: 'alert'
      });
    } catch (error) {
      console.error('Error completing profile:', error);
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-slate-600">Cargando...</p>
        </div>
      </div>
    );
  }

  // Maintenance mode: block non-admin users with a friendly screen
  if (config?.maintenance_mode && user?.role !== 'admin') {
    return (
      <Suspense fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="text-center text-slate-600">Cargando...</div>
        </div>
      }>
        <MaintenanceScreen message={config?.maintenance_message} imageUrl={config?.maintenance_image_url || "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/695da428c9924ef9b68e8866/95348d1e0_generated_image.png"} />
      </Suspense>
    );
  }

  // If client account is disabled, show only the disabled message (no sidebar or header)
  if (user?.role === 'user' && user.is_active === false) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white rounded-xl shadow border p-6 text-center">
          <div className="text-rose-600 text-2xl mb-2">⛔</div>
          <h2 className="text-xl font-semibold text-slate-800">Cuenta desactivada</h2>
          <p className="text-slate-600 mt-1">Tu cuenta ha sido desactivada por el equipo de soporte. Si crees que es un error, por favor contáctanos.</p>
          <div className="mt-5">
            <Button onClick={() => base44.auth.logout()} className="bg-blue-600 hover:bg-blue-700">Cerrar sesión</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-slate-50 flex flex-col lg:flex-row overflow-x-hidden ${isAdminPanel ? 'lg:h-screen lg:overflow-hidden' : ''}`}>
      <style>{`
        /* Respect safe areas */
        :root { 
          --sat: env(safe-area-inset-top); 
          --sab: env(safe-area-inset-bottom); 
        }
        /* toasts visible */
        body { overflow-x: hidden; }

        /* Mobile responsiveness improvements */
        @media (max-width: 640px) {
          /* Make tab lists horizontally scrollable */
          [role="tablist"] {
            display: flex;
            gap: 0.5rem;
            overflow-x: auto !important;
            white-space: nowrap !important;
            -webkit-overflow-scrolling: touch;
            scroll-snap-type: x proximity;
          }
          [role="tablist"] > * { flex: 0 0 auto; scroll-snap-align: start; }

          /* Wrap common action rows/buttons instead of overflowing */
          .header-actions, .actions-row, .btn-row, .toolbar, .filters-row,
          .flex.justify-between, .flex.items-center.gap-2 {
            flex-wrap: wrap !important;
            row-gap: .5rem;
          }

          /* Ensure complex grids collapse to 1 column on mobile */
          .grid[class*="grid-cols-"] { grid-template-columns: 1fr !important; }

          /* Tables: enable safe horizontal scroll */
          table {
            display: block;
            width: 100%;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            white-space: nowrap;
          }

          /* Editors/toolbars should never overflow */
          .ql-toolbar { max-width: 100% !important; overflow: hidden; }
          .ql-container { max-width: 100% !important; }
          .ql-toolbar .ql-formats { flex-wrap: wrap; }

          /* Charts/images full width */
          img, canvas, svg { max-width: 100%; height: auto; }
          .recharts-wrapper, .recharts-responsive-container { max-width: 100% !important; }
        }
      `}</style>
      <Toaster position="top-right" richColors />
      <GlobalErrorListener />
      <Suspense fallback={null}><AdminNotificationCenter user={user} /></Suspense>
      <Suspense fallback={null}><ApiStatusIndicator /></Suspense>
      {user && (
        <Suspense fallback={null}><PWAInstallPrompt /></Suspense>
      )}
      {user?.role === 'user' && (
        <Suspense fallback={null}><WhatsAppSupport /></Suspense>
      )}
      {user?.role === 'user' && config?.chatbot_enabled && (
        <Suspense fallback={null}><ChatbotAssistant user={user} /></Suspense>
      )}
      
      {user && (
        <div className={isAdminPanel ? 'lg:h-screen lg:overflow-y-auto' : ''}>
          <Sidebar 
            user={user} 
            currentPage={currentPageName}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
        </div>
      )}

      <main className={`flex-1 min-h-screen flex flex-col ${isAdminPanel ? 'lg:h-screen lg:overflow-y-auto' : ''}`}>
        {/* Mobile Header */}
        {user && (
        <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="flex items-center justify-between gap-2">
            <Button 
              variant="ghost" 
              size="icon"
              className="h-12 w-12 -ml-2 p-0 touch-manipulation select-none active:opacity-80"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </Button>
            <h1 className="text-sm font-semibold text-slate-800 flex-1 text-center truncate">{config?.app_name || 'TLEC CARGO'}</h1>
            <Suspense fallback={null}><NotificationCenter user={user} /></Suspense>
          </div>
        </header>
        )}

        {/* Desktop Notification Center */}
        {user && (
        <div className="hidden lg:block fixed top-4 right-4 z-40">
          <Suspense fallback={null}><NotificationCenter user={user} /></Suspense>
        </div>
        )}

        {/* Improve mobile tap targets in header */}
        <style>{`
          @media (max-width: 640px) {
            header .h-10.w-10, header .h-9.w-9 { height: 48px !important; width: 48px !important; }
            header .rounded-lg, header .rounded-md { border-radius: 12px !important; }
            header svg { width: 24px; height: 24px; }
          }
        `}</style>

        {/* Main Content */}
        <div className="flex-1 overflow-x-hidden w-full">
          <div className="w-full p-4 md:p-6 lg:p-8 max-w-[100vw]" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 72px)' }}>
            {showBackButton && (
              <div className="mb-3">
                <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
                  <ArrowLeft className="h-4 w-4" /> Atrás
                </Button>
              </div>
            )}
            <ErrorBoundary>
              {React.cloneElement(children, { user, refreshUser: loadUser })}
            </ErrorBoundary>
          </div>
        </div>
      </main>



      {/* Modals */}
      {showContract && (
        <Suspense fallback={null}>
          <ContractModal 
            open={true} 
            onAccept={handleContractAccept}
            onReject={handleContractReject}
          />
        </Suspense>
      )}
      {showProfile && (
        <Suspense fallback={null}>
          <ProfileSetupModal 
            open={true} 
            onComplete={handleProfileComplete}
          />
        </Suspense>
      )}
    </div>
  );
}