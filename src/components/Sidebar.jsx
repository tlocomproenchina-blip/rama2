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
  Mail } from
'lucide-react';
import { Button } from "@/components/ui/button";
import { base44 } from '@/api/base44Client';
import { cacheManager } from '@/components/CacheManager';

export default function Sidebar({ user, currentPage, isOpen, onClose }) {
  const [config, setConfig] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [notificationCounts, setNotificationCounts] = useState({
    critical: 0,
    packages: 0,
    requests: 0
  });

  useEffect(() => {
    loadConfig();
    loadUserRole();
    loadNotificationCounts();
    
    // Poll for notification counts every 180 seconds
    const interval = setInterval(loadNotificationCounts, 180000);
    return () => clearInterval(interval);
  }, [user]);

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

  const loadUserRole = async () => {
    try {
      if (!user?.role_key && !user?.role) return;
      
      // Get role key - use custom role_key or fallback to basic role
      const roleKey = user.role_key || user.role || 'user';
      
      const roles = await base44.entities.Role.filter({ role_key: roleKey, is_active: true });
      if (roles.length > 0) {
        setUserRole(roles[0]);
      }
    } catch (error) {
      console.error('Error loading user role:', error);
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
  const isAdmin = user?.role === 'admin';
  const isEmployee = user?.is_employee === true;
  const permissions = user?.admin_permissions || {};

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
  { name: 'Dashboard Admin', page: 'AdminDashboard', icon: LayoutDashboard, permission: 'view_packages' },
  { name: 'Reportes', page: 'AdminReports', icon: BarChart3, permission: 'view_packages' },
  { name: 'Paquetes', page: 'AdminPackages', icon: Package, permission: 'view_packages' },
  { name: 'Aprobaciones', page: 'AdminConsolidate', icon: Layers, permission: 'consolidate' },
  { name: 'Consolidar', page: 'AdminShipmentApprovals', icon: CheckCircle2, permission: 'consolidate' },
  { name: 'Facturas', page: 'AdminInvoices', icon: FileText, permission: 'validate_payments' },
  { name: 'Validar Pagos', page: 'AdminPayments', icon: CreditCard, permission: 'validate_payments' },
  { name: 'Enviar Emails', page: 'AdminEmailCampaigns', icon: Mail, permission: 'general_config' },
  { name: 'Plantillas Email', page: 'AdminEmailTemplates', icon: FileText, permission: 'general_config' },
  { name: 'Alertas de Pago', page: 'AdminPaymentAlerts', icon: AlertTriangle, permission: 'validate_payments' },
  { name: 'Promociones', page: 'AdminPromotions', icon: Tag, permission: 'general_config' },
  { name: 'Marketing', page: 'AdminMarketing', icon: TrendingUp, permission: 'general_config' },
  { name: 'Seguimiento', page: 'ShipmentTracking', icon: Truck, permission: 'view_packages' },
  { name: 'Calculadora', page: 'ShippingCalculator', icon: Calculator, permission: 'view_packages' },
  { name: 'Tracking Asegurados', page: 'AdminInsured', icon: ShieldCheck, permission: 'view_packages' },
  { name: 'Tickets Soporte', page: 'AdminSupportTickets', icon: MessageCircle, permission: 'view_packages' },
  { name: 'Gestionar FAQ', page: 'AdminFAQ', icon: HelpCircle, permission: 'general_config' },
  { name: 'Clientes', page: 'AdminClients', icon: Users, permission: 'view_packages' },
  { name: 'Eliminar', page: 'AdminDelete', icon: Trash2, permission: 'view_packages' },
  { name: 'Administradores', page: 'AdminPermissions', icon: Shield, permission: 'invite_users' },
  { name: 'Configuración', page: 'AdminSettings', icon: Settings, permission: 'general_config' }];


  const employeeMenuItems = [
  { name: 'Dashboard', page: 'EmployeeDashboard', icon: LayoutDashboard },
  { name: 'Clientes', page: 'AdminClients', icon: Users },
  { name: 'Paquetes', page: 'AdminPackages', icon: Package },
  { name: 'Consolidar', page: 'AdminConsolidate', icon: Layers },
  { name: 'Seguimiento', page: 'ShipmentTracking', icon: Truck }];


  const getMenuItems = () => {
    // If user has a role with visible_pages, use that
    if (userRole?.visible_pages && userRole.visible_pages.length > 0) {
      const allPages = [...adminMenuItems, ...employeeMenuItems, ...clientMenuItems];
      return allPages.filter(item => userRole.visible_pages.includes(item.page));
    }
    
    // Fallback to legacy logic
    if (isAdmin) {
      return adminMenuItems.filter((item) => !item.permission || permissions[item.permission] !== false);
    }
    if (user?.is_employee && user?.admin_permissions) {
      return employeeMenuItems.filter(item => {
        const permissionMap = {
          'AdminPackages': 'view_packages',
          'AdminClients': 'view_clients',
          'AdminConsolidate': 'consolidate'
        };
        const requiredPerm = permissionMap[item.page];
        return !requiredPerm || user.admin_permissions[requiredPerm];
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
              isEmployee ? 'bg-blue-500/20 text-blue-400' :
              'bg-emerald-500/20 text-emerald-400'}`
              }>
                {isAdmin ? 'Administrador' : isEmployee ? 'Empleado' : 'Cliente'}
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