import React, { useState, useEffect, useCallback } from 'react';
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
  Mail,
  Wallet,
  Gift
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { base44 } from '@/components/api/ApiQueueManager';
import { cacheManager } from '@/components/CacheManager';
import OptimizedImage from '@/components/OptimizedImage';
import useAttentionFlags from '@/components/notifications/useAttentionFlags';

export default function Sidebar({ user, currentPage, isOpen, onClose }) {
  const [config, setConfig] = useState(null);


  const loadConfig = useCallback(async () => {
    try {
      // Check cache manager (1 hour TTL)
      const cached = cacheManager.get('app_config');
      if (cached) {
        setConfig(cached);
        return;
      }

      // Load from API only if cache expired
      const configs = await base44.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1);
      if (configs.length > 0) {
        setConfig(configs[0]);
        cacheManager.set('app_config', configs[0], 3600000); // 1 hour
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);




  const [roleConfig, setRoleConfig] = useState(null);
  const isAdmin = user?.role === 'admin';
  const customRole = user?.custom_role;
  const isClient = user?.role === 'user' && !customRole;
  const [flags, markSeen] = useAttentionFlags({ user });

  const handleMenuClick = useCallback((page) => {
    if (page) { try { markSeen(page); } catch {} }
    onClose && onClose();
  }, [markSeen, onClose]);
  // Auto-limpiar el punto si el usuario llegó a la página por otra vía (no solo desde el sidebar)
  useEffect(() => {
    try {
      if (currentPage && flags[currentPage]) {
        markSeen(currentPage);
      }
    } catch {}
  }, [currentPage, flags, markSeen]);
  // Notifications UI disabled
  const showWarning = false;
  const badgeCount = 0;


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
  { name: 'Mis Referidos', page: 'MyReferrals', icon: Gift },
  { name: 'Mis Paquetes', page: 'MyPackages', icon: Package },
  { name: 'Pre-alerta', page: 'PreAlert', icon: FileText },
  { name: 'Solicitar Consolidación', page: 'RequestConsolidation', icon: Layers },
  { name: 'Consolidaciones', page: 'MyConsolidations', icon: Layers },
  { name: 'Mis Facturas', page: 'MyInvoices', icon: FileText },
  { name: 'Pago Asistido', page: 'AssistedPayment', icon: CreditCard },
  { name: 'Seguimiento', page: 'ShipmentTracking', icon: Truck },
  { name: 'Calculadora', page: 'ShippingCalculator', icon: CreditCard },
  { name: 'Tarifas', page: 'Rates', icon: FileText },
  { name: 'Ayuda (FAQ)', page: 'FAQ', icon: HelpCircle },
  { name: 'Soporte', page: 'Support', icon: MessageCircle }];


  const adminMenuItems = [
  { name: 'Dashboard Admin', page: 'AdminDashboard', icon: LayoutDashboard },
  { name: 'Reportes', page: 'AdminReports', icon: BarChart3 },
  { name: 'Análisis Cliente', page: 'ClientAnalytics', icon: TrendingUp },
  { name: 'Paquetes', page: 'AdminPackages', icon: Package },
  { name: 'Dashboard Almacén', page: 'WarehouseDashboard', icon: LayoutDashboard },
  { name: 'Recepción Almacén', page: 'WarehouseReceive', icon: Package },
  { name: 'Ubicaciones y Sedes', page: 'WarehouseLocations', icon: Layers },
  { name: 'Picking y Packing', page: 'WarehousePickPackShip', icon: Truck },
  { name: 'Aprobaciones', page: 'AdminConsolidate', icon: Layers },
  { name: 'Consolidar', page: 'AdminShipmentApprovals', icon: CheckCircle2 },
  { name: 'Dashboard Contabilidad', page: 'AccountingDashboard', icon: LayoutDashboard },
  { name: 'Facturas', page: 'AdminInvoices', icon: FileText },
  { name: 'Validar Pagos', page: 'AdminPayments', icon: CreditCard },
  { name: 'Pagos Asistidos', page: 'AdminAssistedPayments', icon: CreditCard },
  { name: 'Cuentas por Pagar', page: 'AdminAccountsPayable', icon: Wallet },
  { name: 'Pagos Proveedores', page: 'AdminProviderPayments', icon: CreditCard },
  { name: 'Proveedores', page: 'AdminProviders', icon: Users },
  { name: 'Enviar Emails', page: 'AdminEmailCampaigns', icon: Mail },
  { name: 'Plantillas Email', page: 'AdminEmailTemplates', icon: FileText },
  { name: 'Alertas de Pago', page: 'AdminPaymentAlerts', icon: AlertTriangle },
  { name: 'Promociones', page: 'AdminPromotions', icon: Tag },
  { name: 'Marketing', page: 'AdminMarketing', icon: TrendingUp },
  { name: 'Blog', page: 'AdminBlog', icon: FileText },
  { name: 'Seguimiento', page: 'ShipmentTracking', icon: Truck },
  { name: 'Calculadora', page: 'ShippingCalculator', icon: Calculator },
  { name: 'Tracking Asegurados', page: 'AdminInsured', icon: ShieldCheck },
  { name: 'Tickets Soporte', page: 'AdminSupportTickets', icon: MessageCircle },
  { name: 'Gestionar FAQ', page: 'AdminFAQ', icon: HelpCircle },
  { name: 'Clientes', page: 'AdminClients', icon: Users },
  { name: 'Referidos', page: 'AdminReferrals', icon: Gift },
  { name: 'Base de Conocimiento', page: 'AdminKnowledgeBase', icon: FileText },
  { name: 'Eliminar', page: 'AdminDelete', icon: Trash2 },
{ name: 'Administradores', page: 'AdminPermissions', icon: Shield },
  { name: 'Gestión de Roles', page: 'AdminRoles', icon: Shield },
  { name: 'Configuración', page: 'AdminSettings', icon: Settings }];


  const adminGroups = [
    { label: 'PRINCIPAL', items: ['AdminDashboard','AdminReports','ClientAnalytics'] },
    { label: 'OPERACIONES', items: ['AdminPackages','AdminConsolidate','AdminShipmentApprovals'] },
    { label: 'ALMACÉN', items: ['WarehouseDashboard','WarehouseReceive','WarehouseLocations','WarehousePickPackShip'] },
    { label: 'CONTABILIDAD', items: ['AccountingDashboard','AdminInvoices','AdminPayments','AdminAssistedPayments','AdminAccountsPayable','AdminProviderPayments','AdminProviders'] },
    { label: 'COMUNICACIONES', items: ['AdminEmailCampaigns','AdminEmailTemplates','AdminPaymentAlerts'] },
    { label: 'MARKETING', items: ['AdminPromotions','AdminMarketing','AdminBlog','AdminReferrals'] },
    { label: 'SEGUIMIENTO', items: ['ShipmentTracking','ShippingCalculator','AdminInsured'] },
    { label: 'SOPORTE', items: ['AdminSupportTickets','AdminFAQ'] },
    { label: 'GESTIÓN', items: ['AdminClients','AdminKnowledgeBase','AdminDelete','AdminPermissions','AdminRoles','AdminSettings'] }
  ];

  const clientGroups = [
    { label: 'PRINCIPAL', items: ['ClientPortal','Dashboard'] },
    { label: 'ENVÍOS', items: ['MyPackages','PreAlert','RequestConsolidation','MyConsolidations'] },
    { label: 'PAGOS', items: ['MyInvoices','AssistedPayment'] },
    { label: 'SEGUIMIENTO', items: ['ShipmentTracking','ShippingCalculator'] },
    { label: 'INFORMACIÓN', items: ['Rates'] },
    { label: 'SOPORTE', items: ['FAQ','Support'] },
    { label: 'CUENTA', items: ['Profile','MyReferrals'] }
  ];

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
                  <OptimizedImage
                    src={config.app_logo_url}
                    alt="Logo"
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                    priority={false}
                  />
                </div>
              ) : (
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Package className="h-5 w-5 text-white" />
                </div>
              )}
              <div>
                <h1 className="text-lg font-bold text-white">
                  {config?.app_name || 'TLEC CARGO'}
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
          {customRole && !roleConfig ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-10 bg-slate-700/40 rounded-xl" />
              <div className="h-10 bg-slate-700/40 rounded-xl" />
              <div className="h-10 bg-slate-700/40 rounded-xl" />
            </div>
          ) : (
              isAdmin ? (
                adminGroups.map((group) => (
                  <div key={group.label} className="mt-3 first:mt-0">
                    <div className="px-3 py-2 text-[10px] font-semibold tracking-wide text-slate-300/70 uppercase">
                      {group.label}
                    </div>
                    <div className="space-y-1">
                      {group.items.map((page) => {
                        const item = adminMenuItems.find(i => i.page === page);
                        if (!item) return null;
                        const Icon = item.icon;
                        const isActive = currentPage === item.page;



                        return (
                          <Link
                            key={item.page}
                            to={createPageUrl(item.page)}
                            onClick={() => handleMenuClick(item.page)}
                            className={`
                              flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                              ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'}
                            `}
                          >
                            <div className="flex items-center gap-3">
                              <Icon className="h-5 w-5 flex-shrink-0" />
                              <span className="font-medium">{item.name}</span>
                                                              {flags[item.page] && (
                                                                <span className="ml-auto h-2.5 w-2.5 rounded-full bg-amber-400 shadow shadow-amber-500/40" />
                                                              )}
                                                            </div>
                            
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : isClient ? (
                clientGroups.map((group) => (
                  <div key={group.label} className="mt-3 first:mt-0">
                    <div className="px-3 py-2 text-[10px] font-semibold tracking-wide text-slate-300/70 uppercase">
                      {group.label}
                    </div>
                    <div className="space-y-1">
                      {group.items.map((page) => {
                        const item = clientMenuItems.find(i => i.page === page);
                        if (!item) return null;
                        const Icon = item.icon;
                        const isActive = currentPage === item.page;



                        return (
                          <Link
                            key={item.page}
                            to={createPageUrl(item.page)}
                            onClick={() => handleMenuClick(item.page)}
                            className={`
                              flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                              ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'}
                            `}
                          >
                            <div className="flex items-center gap-3">
                              <Icon className="h-5 w-5 flex-shrink-0" />
                              <span className="font-medium">{item.name}</span>
                                                              {flags[item.page] && (
                                                                <span className="ml-auto h-2.5 w-2.5 rounded-full bg-amber-400 shadow shadow-amber-500/40" />
                                                              )}
                                                            </div>
                            
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                getMenuItems().map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPage === item.page;



                  return (
                    <Link
                      key={item.page}
                      to={createPageUrl(item.page)}
                      onClick={() => handleMenuClick(item.page)}
                      className={`
                        flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                        ${isActive ?
                      'bg-blue-600 text-white shadow-lg shadow-blue-600/30' :
                      'text-slate-300 hover:bg-slate-700/50 hover:text-white'}
                      `
                      }>
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 flex-shrink-0" />
                        <span className="font-medium">{item.name}</span>
                      </div>

                    </Link>
                  );
                })
              )
            )}
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