import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import Sidebar from '@/components/Sidebar';
import ContractModal from '@/components/ContractModal';
import ProfileSetupModal from '@/components/ProfileSetupModal';
import NotificationBell from '@/components/NotificationBell';
import { Menu, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Toaster } from 'sonner';

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showContract, setShowContract] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Redirect admin to dashboard if on home page
      if (currentUser.role === 'admin' && (!currentPageName || currentPageName === 'Home' || currentPageName === 'Dashboard')) {
        navigate(createPageUrl('AdminDashboard'));
        setLoading(false);
        return;
      }

      // Check contract and profile for regular users
      if (currentUser.role === 'user') {
        if (!currentUser.contract_accepted) {
          setShowContract(true);
        } else if (!currentUser.profile_completed) {
          setShowProfile(true);
        }
      }
    } catch (error) {
      // Not logged in - redirect to login
      base44.auth.redirectToLogin();
    }
    setLoading(false);
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
      import('@/components/NotificationUtils').then(({ notifyAdmins }) => {
        notifyAdmins({
          subject: '👤 Nuevo usuario registrado',
          body: `Un nuevo usuario ha completado su registro:\n\nNombre: ${profileData.first_name} ${profileData.last_name}\nCiudad: ${profileData.city}\nWhatsApp: ${profileData.whatsapp}\nEmail: ${user.email}\n\nPor favor asigna un Shipping Mark al usuario desde el panel de Clientes.`,
          message: `${profileData.first_name} ${profileData.last_name} (${user.email}) completó su registro`,
          type: 'general',
          icon: 'alert'
        });
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

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Toaster position="top-right" richColors />
      
      <Sidebar 
        user={user} 
        currentPage={currentPageName}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="flex-1 min-h-screen">
        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </Button>
            <h1 className="font-semibold text-slate-800">TLEC Logistics</h1>
            <NotificationBell user={user} />
          </div>
        </header>

        {/* Desktop Notification Bell */}
        <div className="hidden lg:block fixed top-4 right-4 z-40">
          <NotificationBell user={user} />
        </div>

        <div className="p-4 lg:p-8">
          {React.cloneElement(children, { user, refreshUser: loadUser })}
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