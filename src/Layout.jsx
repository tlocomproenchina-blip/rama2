import React, { useState, useEffect } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import Sidebar from '@/components/Sidebar';
import ContractModal from '@/components/ContractModal';
import ProfileSetupModal from '@/components/ProfileSetupModal';
import NotificationCenter from '@/components/NotificationCenter';
import AdminNotificationCenter from '@/components/AdminNotificationCenter';
import ApiStatusIndicator from '@/components/api/ApiStatusIndicator';
import WhatsAppSupport from '@/components/WhatsAppSupport';
import ChatbotAssistant from '@/components/ChatbotAssistant';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import { notifyAdmins } from '@/components/NotificationUtils';
import { Menu, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Toaster } from 'sonner';

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showContract, setShowContract] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadUser();
    loadConfig();
    loadFavicon();
  }, []);

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

      // Block access for inactive clients
      if (currentUser.role === 'user' && currentUser.is_active === false) {
        navigate(createPageUrl('AccountDisabled'));
        setLoading(false);
        return;
      }

      // Redirect admin to admin dashboard
      if (currentUser.role === 'admin' && (!currentPageName || currentPageName === 'Home' || currentPageName === 'Dashboard')) {
        navigate(createPageUrl('AdminDashboard'));
        setLoading(false);
        return;
      }

      // Redirect custom role users to their dashboard
      if (currentUser.custom_role && (!currentPageName || currentPageName === 'Home' || currentPageName === 'Dashboard')) {
        const roleConfigs = await base44.entities.RoleConfig.filter({ 
          role_code: currentUser.custom_role,
          is_active: true
        });
        
        if (roleConfigs.length > 0) {
          const visiblePages = roleConfigs[0].visible_pages || [];
          
          // Redirect to specialized dashboard for accounting role
          if (currentUser.custom_role === 'accounting') {
            navigate(createPageUrl('AccountingDashboard'));
            return;
          } else if (visiblePages.includes('AdminDashboard')) {
            navigate(createPageUrl('AdminDashboard'));
            return;
          } else if (visiblePages.includes('EmployeeDashboard')) {
            navigate(createPageUrl('EmployeeDashboard'));
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
          
          if (missingFields.length > 0 && (!currentPageName || currentPageName === 'Home' || currentPageName === 'Dashboard')) {
            navigate(createPageUrl('Profile'));
            return;
          }
        }
      }
      
      setLoading(false);
    } catch (error) {
      // Not logged in - redirect to login
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

  // If client account is disabled, show only the disabled message (no sidebar or header)
  if (user?.role === 'user' && user.is_active === false) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        {React.cloneElement(children, { user, refreshUser: loadUser })}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row overflow-x-hidden">
      <style>{`
        [data-sonner-toaster] { display: none !important; }
        body { overflow-x: hidden; }
      `}</style>
      <Toaster position="top-right" richColors />
      <AdminNotificationCenter user={user} />
      <ApiStatusIndicator />
      <PWAInstallPrompt />
      {user?.role === 'user' && <WhatsAppSupport />}
      {user?.role === 'user' && config?.chatbot_enabled && <ChatbotAssistant user={user} />}
      
      <Sidebar 
        user={user} 
        currentPage={currentPageName}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="flex-1 min-h-screen flex flex-col">
        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <Button 
              variant="ghost" 
              size="icon"
              className="h-10 w-10"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-sm font-semibold text-slate-800 flex-1 text-center truncate">{config?.app_name || 'TLEC Logistics'}</h1>
            <NotificationCenter user={user} />
          </div>
        </header>

        {/* Desktop Notification Center */}
        <div className="hidden lg:block fixed top-4 right-4 z-40">
          <NotificationCenter user={user} />
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-x-hidden w-full">
          <div className="w-full p-4 md:p-6 lg:p-8 max-w-[100vw]">
            {React.cloneElement(children, { user, refreshUser: loadUser })}
          </div>
        </div>
      </main>

      {/* Modals */}
      <ContractModal 
        open={showContract} 
        onAccept={handleContractAccept}
        onReject={handleContractReject}
      />
      <ProfileSetupModal 
        open={showProfile} 
        onComplete={handleProfileComplete}
      />
    </div>
  );
}