import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  LayoutDashboard,
  Package,
  Layers,
  Users,
  Settings,
  CreditCard,
  Shield,
  FileText,
  ShieldCheck,
  LogOut,
  X,
  Truck,
  MessageCircle,
  Calculator,
  Trash2,
  AlertTriangle,
  HelpCircle,
  BarChart3,
  Tag,
  TrendingUp,
  CheckCircle2,
  Mail
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { base44 } from '@/api/base44Client';
import { cacheManager } from '@/components/CacheManager';

export default function Sidebar({ user, currentPage, isOpen, onClose }) {
  const [config, setConfig] = useState(null);
  const [notificationCounts, setNotificationCounts] = useState({
    critical: 0,
    packages: 0,
    requests: 0
  });

  useEffect(() => {
    loadConfig();
    loadNotificationCounts();
    
    // Poll for notification counts every 180 seconds
    const interval = setInterval(loadNotificationCounts, 180000);
    return () => clearInterval(interval);
  }, []);

  const loadConfig = async () => {
    try {
      // Check cache manager (1 hour TTL)
      const cached = cacheManager.get('app_config');
      if (cached) {
        setConfig(cached);
        return;
      }

      // Load from API only if cache expired
      const configs = await base44.entities.AppConfig.filter({ config_key: 'main' });
      if (configs.length > 0) {
        setConfig(configs[0]);
        cacheManager.set('app_config', configs[0], 3600000); // 1 hour
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  };

  const loadNotificationCounts = async () => {
    try {
      if (!user?.email) return;

      const notifications = await base44.entities.Notification.filter({
        user_email: user.email,
        read: false
      });

      const critical = notifications.filter(n => n.priority === 'critical').length;
      const packageCount = notifications.filter(n => n.entity_type === 'Package').length;
      const requestCount = notifications.filter(n => n.entity_type === 'ConsolidationRequest').length;

      setNotificationCounts({
        critical,
        packages: packageCount,
        requests: requestCount
      });
    } catch (error) {
      console.error('Error loading notification counts:', error);
    }
  };
  const [roleConfig, setRoleConfig] = useState(null);
  const isAdmin = user?.role === 'admin';
  const customRole = user?.custom_role;

  useEffect(() => {
    if (customRole) {
      loadRoleConfig();
    }
  }, [customRole]);

  const loadRoleConfig = async () => {
    try {
      const configs = await base44.entities.RoleConfig.filter({ 
        role_code: customRole,
        is_active: true
      });
      if (configs.length > 0) {
        setRoleConfig(configs[0]);
      }
    } catch (error) {
      console.error('Error loading role config:', error);
    }
  };

  const clientMenuItems = [
  { name: 'Mi Portal', page: 'ClientPortal', icon: LayoutDashboard },
  { name: 'Dashboard', page: 'Dashboard', icon: LayoutDashboard },
  { name: 'Mi Perfil', page: 'Profile', icon: Users },
  { name: 'Mis Paquetes', page: 'MyPackages', icon: Package },
  { name: 'Pre-alerta', page: 'PreAlert', icon: FileText },
  { name: 'Solicitar Consolidación', page: 'RequestConsolidation', icon: Layers },
  { name: 'Consolidaciones', page: 'MyConsolidations', icon: Layers },
  { name: 'Mis Facturas', page: 'MyInvoices', icon: FileText },
  { name: 'Seguimiento', page: 'ShipmentTracking', icon: Truck },
  { name: 'Calculadora', page: 'ShippingCalculator', icon: CreditCard },
  { name: 'Tarifas', page: 'Rates', icon: FileText },
  { name: 'Ayuda (FAQ)', page: 'FAQ', icon: HelpCircle },
  { name: 'Soporte', page: 'Support', icon: MessageCircle }];


  const adminMenuItems = [
  { name: 'Dashboard Admin', page: 'AdminDashboard', icon: LayoutDashboard },
  { name: 'Reportes', page: 'AdminReports', icon: BarChart3 },
  { name: 'Paquetes', page: 'AdminPackages', icon: Package },
  { name: 'Aprobaciones', page: 'AdminConsolidate', icon: Layers },
  { name: 'Consolidar', page: 'AdminShipmentApprovals', icon: CheckCircle2 },
  { name: 'Facturas', page: 'AdminInvoices', icon: FileText },
  { name: 'Validar Pagos', page: 'AdminPayments', icon: CreditCard },
  { name: 'Enviar Emails', page: 'AdminEmailCampaigns', icon: Mail },
  { name: 'Plantillas Email', page: 'AdminEmailTemplates', icon: FileText },
  { name: 'Alertas de Pago', page: 'AdminPaymentAlerts', icon: AlertTriangle },
  { name: 'Promociones', page: 'AdminPromotions', icon: Tag },
  { name: 'Marketing', page: 'AdminMarketing', icon: TrendingUp },
  { name: 'Seguimiento', page: 'ShipmentTracking', icon: Truck },
  { name: 'Calculadora', page: 'ShippingCalculator', icon: Calculator },
  { name: 'Tracking Asegurados', page: 'AdminInsured', icon: ShieldCheck },
  { name: 'Tickets Soporte', page: 'AdminSupportTickets', icon: MessageCircle },
  { name: 'Gestionar FAQ', page: 'AdminFAQ', icon: HelpCircle },
  { name: 'Clientes', page: 'AdminClients', icon: Users },
  { name: 'Eliminar', page: 'AdminDelete', icon: Trash2 },
  { name: 'Administradores', page: 'AdminPermissions', icon: Shield },
  { name: 'Gestión de Roles', page: 'AdminRoles', icon: Shield },
  { name: 'Configuración', page: 'AdminSettings', icon: Settings }];


  const employeeMenuItems = [
  { name: 'Dashboard', page: 'EmployeeDashboard', icon: LayoutDashboard },
  { name: 'Clientes', page: 'AdminClients', icon: Users },
  { name: 'Paquetes', page: 'AdminPackages', icon: Package },
  { name: 'Consolidar', page: 'AdminConsolidate', icon: Layers },
  { name: 'Seguimiento', page: 'ShipmentTracking', icon: Truck }];

  const accountingMenuItems = [
  { name: 'Dashboard', page: 'AccountingDashboard', icon: LayoutDashboard },
  { name: 'Validar Pagos', page: 'AdminPayments', icon: CreditCard },
  { name: 'Facturas', page: 'AdminInvoices', icon: FileText },
  { name: 'Alertas de Pago', page: 'AdminPaymentAlerts', icon: AlertTriangle },
  { name: 'Reportes', page: 'AdminReports', icon: BarChart3 }];


  const getMenuItems = () => {
    if (isAdmin) return adminMenuItems;

    // Avoid flicker: if user has a custom role but roleConfig not loaded yet, render nothing
    if (customRole && !roleConfig) return [];

    if (customRole && roleConfig) {
      const visiblePages = roleConfig.visible_pages || [];

      // Special handling for accounting role
      if (customRole === 'accounting') {
        return accountingMenuItems.filter(item => visiblePages.includes(item.page));
      }

      const allMenuItems = [...adminMenuItems, ...employeeMenuItems, ...clientMenuItems];
      const seen = new Set();
      return allMenuItems.filter(item => {
        if (visiblePages.includes(item.page) && !seen.has(item.page)) {
          seen.add(item.page);
          return true;
        }
        return false;
      });
    }

    return clientMenuItems;
  };

  const handleLogout = () => {
    base44.auth.logout();
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen &&
      <div
        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        onClick={onClose} />

      }
      
      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-72 bg-gradient-to-b from-slate-900 to-slate-800 
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        flex flex-col
      `}>
        {/* Header */}
        <div className="bg-[#1c3f82] p-6 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {config?.app_logo_url ? (
                <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg bg-white flex items-center justify-center">
                  <img 
                    src={config.app_logo_url} 
                    alt="Logo" 
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Package className="h-5 w-5 text-white" />
                </div>
              )}
              <div>
                <h1 className="text-lg font-bold text-white">
                  {config?.app_name || 'TLEC Logistics'}
                </h1>
                <p className="text-xs text-slate-400">
                  {config?.app_tagline || 'Sistema de Envíos'}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-slate-400 hover:text-white"
              onClick={onClose}>

              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* User Info */}
        <div className="bg-[#1c3f82] px-4 py-4 border-b border-slate-700/50">
          <div className="bg-slate-800/50 rounded-xl p-3">
            <p className="text-sm font-medium text-white truncate">{user?.full_name || user?.email}</p>
            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              isAdmin ? 'bg-amber-500/20 text-amber-400' :
              customRole ? 'bg-blue-500/20 text-blue-400' :
              'bg-emerald-500/20 text-emerald-400'}`
              }>
                {isAdmin ? 'Administrador' : roleConfig?.role_name || 'Cliente'}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="bg-[#1c3f82] p-4 flex-1 overflow-y-auto space-y-1">
          {getMenuItems().map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.page;
            
            // Get badge count for this item
            let badgeCount = null;
            let showWarning = false;
            
            if (item.page === 'Dashboard' || item.page === 'ClientPortal') {
              showWarning = notificationCounts.critical > 0;
            } else if (item.page === 'MyPackages' || item.page === 'AdminPackages') {
              badgeCount = notificationCounts.packages;
            } else if (item.page === 'RequestConsolidation') {
              badgeCount = notificationCounts.requests;
            }

            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                onClick={onClose}
                className={`
                  flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all duration-200
                  ${isActive ?
                'bg-blue-600 text-white shadow-lg shadow-blue-600/30' :
                'text-slate-300 hover:bg-slate-700/50 hover:text-white'}
                `
                }>
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span className="font-medium">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {showWarning && (
                    <span className="text-amber-400 animate-pulse">⚠</span>
                  )}
                  {badgeCount > 0 && (
                    <span className="bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                      {badgeCount > 9 ? '9+' : badgeCount}
                    </span>
                  )}
                </div>
              </Link>);

          })}
        </nav>

        {/* Logout */}
        <div className="bg-[#1c3f82] p-4 border-t border-slate-700/50">
          <Button
            variant="ghost"
            className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-700/50"
            onClick={handleLogout}>

            <LogOut className="h-5 w-5 mr-3" />
            Cerrar Sesión
          </Button>
        </div>
      </aside>
    </>);

}