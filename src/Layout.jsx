import React, { useState, useEffect, Suspense, lazy, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { base44, setApiTuning } from '@/components/api/ApiQueueManager';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import Sidebar from '@/components/Sidebar';
import NotificationBell from '@/components/NotificationBell';
import AdminNotificationCenter from '@/components/AdminNotificationCenter';
import { getDefaultRoleConfig } from '@/lib/rolePermissions';








import { notifyAdmins, sendTemplatedEmail } from '@/components/NotificationUtils';
import { Menu, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from "@/components/ui/button";

import ErrorBoundary from '@/components/common/ErrorBoundary';
import SoftErrorBoundary from '@/components/common/SoftErrorBoundary';
import GlobalErrorListener from '@/components/common/GlobalErrorListener';
import PullToRefresh from '@/components/common/PullToRefresh';
import SkipToContent from '@/components/common/SkipToContent';
import InternalFloatingChat from '@/components/internal-messaging/InternalFloatingChat';
import DemoModeBanner from '@/components/common/DemoModeBanner';
import MobileBottomNav from '@/components/navigation/MobileBottomNav';

// Lazy loaded onboarding tour
const GuidedTour = lazy(() =>
  import('@/components/onboarding/GuidedTour').catch(() => ({ default: () => null }))
);
const TourTriggerButton = lazy(() =>
  import('@/components/onboarding/TourTriggerButton').catch(() => ({ default: () => null }))
);

// Lazy loaded non-critical components
const WhatsAppSupport = lazy(() => import('@/components/WhatsAppSupport'));
const ChatbotAssistant = lazy(() => import('@/components/ChatbotAssistant'));
const PWAInstallPrompt = lazy(() => import('@/components/PWAInstallPrompt'));
const ContractModal = lazy(() => import('@/components/ContractModal.jsx'));
const ProfileSetupModal = lazy(() => import('@/components/ProfileSetupModal'));
const ApiStatusIndicator = lazy(() => import('@/components/api/ApiStatusIndicator'));
const MaintenanceScreen = lazy(() => import('@/components/MaintenanceScreen'));
const lazyWithRetry = (importer) => lazy(async () => {
  try {
    return await importer();
  } catch (err) {
    if (typeof window !== 'undefined' && !sessionStorage.getItem('chunk-reload-once')) {
      sessionStorage.setItem('chunk-reload-once', '1');
      window.location.reload();
    }
    throw err;
  }
});
const GlobalSearchPalette = lazyWithRetry(() => import('@/components/admin/GlobalSearchPalette.jsx'));


export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [config, setConfig] = useState(null);
  const [roleConfig, setRoleConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showContract, setShowContract] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [isInstalledApp, setIsInstalledApp] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [slideDirection, setSlideDirection] = useState(1);
  const historyIndexRef = React.useRef(typeof window !== 'undefined' ? (window.history.state?.idx ?? 0) : 0);
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminPanel = user?.role === 'admin';
  const hasDesktopSidebar = !!user;
  const showBackButton = ['ShippingCalculator', 'Rates', 'Blog', 'BlogPost', 'TermsOfService', 'FAQ'].includes(currentPageName);

  // Tuning sensato: se aplica una sola vez al montar
  useEffect(() => {
    setApiTuning({
      maxReads: 60,
      maxWrites: 30,
      minIntervalMs: 5,
      backoffDelays: [1000, 2000, 4000, 8000, 16000],
      circuitBreakerThreshold: 80,
      circuitOpenMinutes: 1
    });
  }, []);

  useEffect(() => {
    const currentIndex = typeof window !== 'undefined' ? (window.history.state?.idx ?? historyIndexRef.current) : historyIndexRef.current;
    setSlideDirection(currentIndex < historyIndexRef.current ? -1 : 1);
    historyIndexRef.current = currentIndex;
  }, [location.pathname, location.search]);

  // Detect if running as installed PWA (standalone)
  useEffect(() => {
    try {
      const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || (window.navigator && window.navigator.standalone === true);
      setIsInstalledApp(!!isStandalone);
    } catch (_) {
      setIsInstalledApp(false);
    }
  }, []);

  // Close any open Radix overlays (Select/Popover/Dropdown) on route change
  // Disabled to prevent rare DOM NotFoundError during rapid unmounts
  // useEffect(() => {
  //   try {
  //     document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  //   } catch {}
  // }, [location.pathname, location.key]);

  async function loadConfig() {
    try {
      const configs = await base44.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1);
      if (configs.length > 0) {
        const nextConfig = configs[0];
        setConfig(nextConfig);

        const faviconUrl = nextConfig.favicon_url || nextConfig.app_logo_url;
        if (faviconUrl) {
          const link = document.querySelector("link[rel='icon']") || document.createElement('link');
          link.rel = 'icon';
          link.href = faviconUrl;
          link.type = faviconUrl.endsWith('.ico') ? 'image/x-icon' : 'image/png';
          document.head.appendChild(link);
        }
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  }

  async function loadUser() {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      let resolvedRoleConfig = null;
      if (currentUser?.role === 'admin' && currentUser?.custom_role) {
        try {
          const roleRows = await base44.entities.RoleConfig.filter({ role_code: currentUser.custom_role, is_active: true }, '-updated_date', 1);
          resolvedRoleConfig = roleRows?.[0] || getDefaultRoleConfig(currentUser.custom_role);
        } catch {
          resolvedRoleConfig = getDefaultRoleConfig(currentUser.custom_role);
        }
      }
      setRoleConfig(resolvedRoleConfig);

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

      // Redirect admin to AccountingDashboard when landing on Home/Dashboard or no page specified
      if (currentUser.role === 'admin' && (!currentPageName || currentPageName === 'Dashboard' || currentPageName === 'Home')) {
        navigate(createPageUrl('AccountingDashboard'));
        setLoading(false);
        return;
      }

      if (currentUser.role === 'admin' && resolvedRoleConfig?.visible_pages?.length && currentPageName && !resolvedRoleConfig.visible_pages.includes(currentPageName) && !['AccountingDashboard', 'Home', 'Dashboard'].includes(currentPageName)) {
        navigate(createPageUrl(resolvedRoleConfig.visible_pages[0] || 'AccountingDashboard'));
        setLoading(false);
        return;
      }

      // Check contract and profile for regular users
      if (currentUser.role === 'user') {
        if (!currentPageName || currentPageName === 'Home' || currentPageName === 'ClientPortal') {
          navigate(createPageUrl('Dashboard'));
          setLoading(false);
          return;
        }

        if (!currentUser.contract_accepted) {
          setShowContract(true);
          setLoading(false);
          return;
        }

        if (!currentUser.profile_completed) {
          setShowProfile(true);
          setLoading(false);
          return;
        }
      }
      
      setLoading(false);
    } catch (error) {
      // Not logged in - if maintenance is ON, show maintenance instead of redirecting
      try {
        const configs = await base44.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1);
        const cfg = configs[0];
        if (cfg?.maintenance_mode) {
          setConfig(cfg);
          setUser(null);
          setLoading(false);
          return;
        }
      } catch (_) {}
      // Allow specific public pages without login
      const publicPages = ['Home', 'ShippingCalculator', 'Blog', 'BlogPost', 'About', 'Contact'];
      if (publicPages.includes(currentPageName)) {
        setUser(null);
        setLoading(false);
        return;
      }
      // Otherwise require login
      base44.auth.redirectToLogin();
      setLoading(false);
    }
  }

  // Solo cargar usuario y config al montar — no en cada cambio de página
  const hasInitRef = useRef(false);
  useEffect(() => {
    if (!hasInitRef.current) {
      hasInitRef.current = true;
      loadUser();
      loadConfig();
    }
  }, []);

  const handleContractAccept = useCallback(async () => {
    await base44.auth.updateMe({
      contract_accepted: true,
      contract_accepted_date: new Date().toISOString()
    });
    const updated = await base44.auth.me();
    setUser(updated);
    setShowContract(false);
    if (!updated.profile_completed) {
      setShowProfile(true);
    }
  }, []);


  const handleContractReject = useCallback(() => {
    base44.auth.logout();
  }, []);

  const handleProfileComplete = useCallback(async (profileData) => {
    try {
      await base44.auth.updateMe({
        ...profileData,
        profile_completed: true
      });
      setShowProfile(false);

      const shippingMarkResponse = await base44.functions.invoke('generateShippingMark', {});
      const assignedShippingMark = shippingMarkResponse?.data?.shipping_mark;
      const updatedUser = {
        ...user,
        ...profileData,
        profile_completed: true,
        ...(assignedShippingMark ? { shipping_mark: assignedShippingMark } : {})
      };
      setUser(updatedUser);

      // Show onboarding tour for new users
      setTimeout(() => setShowTour(true), 1500);

      await sendTemplatedEmail({
        to: user.email,
        templateName: 'Base - Nuevo Cliente',
        client: updatedUser,
        extraData: { app_name: config?.app_name || 'TLEC CARGO' },
        fallbackSubject: '¡Bienvenido a TLEC CARGO!',
        fallbackBody: 'Hola {cliente_nombre}, tu cuenta ya está activa en TLEC CARGO.',
        title: 'Bienvenido a TLEC CARGO',
        message: 'Tu cuenta ya está activa y lista para usarse.',
        type: 'system',
        icon: 'check'
      });

      notifyAdmins({
        subject: '👤 Nuevo usuario registrado',
        body: `Un nuevo usuario ha completado su registro:\n\nNombre: ${profileData.first_name} ${profileData.last_name}\nCiudad: ${profileData.city}\nWhatsApp: ${profileData.whatsapp}\nEmail: ${user.email}\n\n${assignedShippingMark ? `Shipping Mark asignado automáticamente: ${assignedShippingMark}` : 'Revisa el Shipping Mark según la configuración actual del sistema.'}`,
        message: `${profileData.first_name} ${profileData.last_name} (${user.email}) completó su registro`,
        type: 'general',
        icon: 'alert'
      });
    } catch (error) {
      console.error('Error completing profile:', error);
      throw error;
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
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
        <div className="min-h-screen bg-background flex items-center justify-center">
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
    <div className={`min-h-screen bg-background flex flex-col lg:flex-row overflow-x-hidden ${hasDesktopSidebar ? 'lg:h-screen lg:overflow-hidden' : ''}`}>
      {config?.demo_mode && <DemoModeBanner message={config?.demo_mode_message || 'Modo demo activo: integraciones externas desactivadas.'} />}
      <SkipToContent />
      <style>{`
        /* Respect safe areas */
        :root { 
          --sat: env(safe-area-inset-top); 
          --sab: env(safe-area-inset-bottom); 
        }
        /* toasts visible */
        html { -webkit-text-size-adjust: 100%; }
        body { overflow-x: hidden; overscroll-behavior-y: contain; }
        button, a, [role="button"], [role="tab"] { -webkit-tap-highlight-color: transparent; }
        button, a, [role="button"], [role="tab"], nav { -webkit-user-select: none; user-select: none; }
        input, textarea, [contenteditable="true"] { -webkit-user-select: text; user-select: text; }

        /* Mobile responsiveness improvements */
        @media (max-width: 640px) {
          /* Keep tab lists clean on mobile without horizontal scroll */
          [role="tablist"] {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
            overflow: visible !important;
            white-space: normal !important;
          }
          [role="tablist"] > * { flex: 0 0 auto; }

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
      
      
      
      <Suspense fallback={null}><ApiStatusIndicator /></Suspense>
      <GlobalErrorListener />
      {user?.role === 'admin' && <AdminNotificationCenter user={user} />}
      {user && (
        <Suspense fallback={null}><PWAInstallPrompt /></Suspense>
      )}
      {user?.role === 'user' && (
        <Suspense fallback={null}><WhatsAppSupport /></Suspense>
      )}
      {user?.role === 'user' && config?.chatbot_enabled && (
        <Suspense fallback={null}><ChatbotAssistant user={user} /></Suspense>
      )}

      {user?.role === 'admin' && <InternalFloatingChat user={user} />}

      {user?.role === 'admin' && (
        <Suspense fallback={null}><GlobalSearchPalette /></Suspense>
      )}

      {/* Guided Tour */}
      {user && (
        <Suspense fallback={null}>
          <GuidedTour
            open={showTour}
            onClose={() => { setShowTour(false); setSidebarOpen(false); }}
            isAdmin={user?.role === 'admin'}
            onOpenSidebar={() => setSidebarOpen(true)}
          />
        </Suspense>
      )}
      
      {user && (
        <div className={hasDesktopSidebar ? 'lg:h-screen lg:overflow-y-auto' : ''}>
          <Sidebar 
            user={user} 
            currentPage={currentPageName}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            initialConfig={config}
          />
        </div>
      )}

      <main className={`flex-1 min-h-screen flex flex-col ${hasDesktopSidebar ? 'lg:h-screen lg:overflow-y-auto' : ''}`}>
        {user && (
          <div className="sticky top-0 z-20 hidden lg:flex justify-end items-center gap-2 px-6 pt-4">
            <Suspense fallback={null}>
              <TourTriggerButton onClick={() => setShowTour(true)} />
            </Suspense>
            <div className="rounded-[1.25rem] border border-white/80 bg-white/85 px-2 py-1 shadow-card backdrop-blur">
              <NotificationBell user={user} />
            </div>
          </div>
        )}
        {/* Mobile Header */}
        {user && (
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 px-4 py-3 backdrop-blur lg:hidden" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="rounded-[1.35rem] border border-white/80 bg-white/85 px-3 py-2 shadow-card transition-all duration-300">
            <div className="flex items-center justify-between gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                className={`h-11 w-11 rounded-2xl border p-0 touch-manipulation select-none transition-colors duration-150 active:opacity-80 ${sidebarOpen ? 'border-primary/20 bg-accent text-foreground shadow-sm' : 'border-border/70 bg-white/80'}`}
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="min-w-0 flex-1 px-2 text-center">
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.24em] text-primary/70">Navegación</p>
                <h1 className="truncate font-display text-sm font-semibold text-slate-800">{config?.app_name || 'TLEC CARGO'}</h1>
                <p className="truncate text-[11px] text-slate-500">{currentPageName || 'Panel'}</p>
              </div>
              <div className="flex items-center justify-end gap-1.5">
                <Suspense fallback={null}>
                  <TourTriggerButton onClick={() => setShowTour(true)} />
                </Suspense>
                <NotificationBell user={user} />
              </div>
            </div>
          </div>
        </header>
        )}

        {/* Desktop Notification Center */}


        {/* Improve mobile tap targets in header */}
        <style>{`
          @media (max-width: 640px) {
            header .h-10.w-10, header .h-9.w-9 { height: 48px !important; width: 48px !important; }
            header .rounded-lg, header .rounded-md { border-radius: 12px !important; }
            header svg { width: 24px; height: 24px; }
            aside nav { -webkit-overflow-scrolling: touch; }
          }

          aside nav::-webkit-scrollbar { width: 8px; }
          aside nav::-webkit-scrollbar-track { background: transparent; }
          aside nav::-webkit-scrollbar-thumb {
            background: hsl(var(--border));
            border-radius: 9999px;
            border: 2px solid transparent;
            background-clip: padding-box;
          }
        `}</style>

        {/* Reglas de degradación UI (activadas por data-degrade en <html>) */}
        <style>{`
          [data-degrade="light"] * { transition-duration: 0ms !important; }
          [data-degrade="aggressive"] *, [data-degrade="aggressive"] *::before, [data-degrade="aggressive"] *::after {
            animation: none !important;
            transition: none !important;
            filter: none !important;
          }
        `}</style>

         {/* Main Content */}
        <div id="main-content" tabIndex={-1} className="flex-1 overflow-x-hidden w-full focus:outline-none">
          <PullToRefresh enabled={!!user} onRefresh={() => window.location.reload()}>
            <div className="w-full p-4 md:p-6 lg:p-8 mx-auto max-w-screen-sm sm:max-w-2xl lg:max-w-[100vw]" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 72px)' }}>
              {showBackButton && (
                <div className="mb-3">
                  <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
                    <ArrowLeft className="h-4 w-4" /> Atrás
                  </Button>
                </div>
              )}
              <ErrorBoundary>
                <SoftErrorBoundary name={currentPageName || 'page-content'}>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={location.pathname + location.search}
                      initial={{ opacity: 0, x: slideDirection > 0 ? 28 : -28 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: slideDirection > 0 ? -20 : 20 }}
                      transition={{ duration: 0.22, ease: 'easeOut' }}
                    >
                      {React.cloneElement(children, { user, refreshUser: loadUser })}
                    </motion.div>
                  </AnimatePresence>
                </SoftErrorBoundary>
              </ErrorBoundary>
            </div>
          </PullToRefresh>
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