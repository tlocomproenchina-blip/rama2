import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Package, LogOut, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { base44 } from '@/components/api/ApiQueueManager';
import { cacheManager } from '@/components/CacheManager';
import OptimizedImage from '@/components/OptimizedImage';
import useAttentionFlags from '@/components/notifications/useAttentionFlags';
import SidebarNavGroup from '@/components/sidebar/SidebarNavGroup';
import {
  adminGroups,
  adminMenuItems,
  clientGroups,
  clientMenuItems,
} from '@/components/sidebar/sidebarConfig';
import { getDefaultRoleConfig } from '@/lib/rolePermissions';

export default function Sidebar({ user, currentPage, isOpen, onClose, initialConfig }) {
  const [config, setConfig] = useState(initialConfig || null);
  const [roleConfig, setRoleConfig] = useState(null);


  const loadConfig = useCallback(async () => {
    try {
      if (initialConfig) {
        setConfig(initialConfig);
        cacheManager.set('app_config', initialConfig, 3600000);
        return;
      }

      const cached = cacheManager.get('app_config');
      if (cached) {
        setConfig(cached);
        return;
      }

      const configs = await base44.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1);
      if (configs.length > 0) {
        setConfig(configs[0]);
        cacheManager.set('app_config', configs[0], 3600000);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  }, [initialConfig]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    let active = true;
    const loadRoleConfig = async () => {
      if (user?.role !== 'admin' || !user?.custom_role) {
        if (active) setRoleConfig(null);
        return;
      }
      try {
        const rows = await base44.entities.RoleConfig.filter({ role_code: user.custom_role, is_active: true }, '-updated_date', 1);
        if (active) setRoleConfig(rows?.[0] || getDefaultRoleConfig(user.custom_role));
      } catch {
        if (active) setRoleConfig(getDefaultRoleConfig(user.custom_role));
      }
    };
    loadRoleConfig();
    return () => { active = false; };
  }, [user?.role, user?.custom_role]);




  const isAdmin = user?.role === 'admin';
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


  const visibleAdminPages = useMemo(() => {
    if (user?.role !== 'admin') return [];
    if (!user?.custom_role) return adminMenuItems.map((item) => item.page);
    return roleConfig?.visible_pages || [];
  }, [user?.role, user?.custom_role, roleConfig]);

  const filteredAdminMenuItems = useMemo(() => adminMenuItems.filter((item) => visibleAdminPages.includes(item.page)), [visibleAdminPages]);
  const filteredAdminGroups = useMemo(() => adminGroups.map((group) => ({
    ...group,
    items: group.items.filter((page) => visibleAdminPages.includes(page))
  })).filter((group) => group.items.length > 0), [visibleAdminPages]);

  const adminItemsByPage = useMemo(() => Object.fromEntries(filteredAdminMenuItems.map((item) => [item.page, item])), [filteredAdminMenuItems]);
  const clientItemsByPage = useMemo(() => Object.fromEntries(clientMenuItems.map((item) => [item.page, item])), []);


  const handleLogout = useCallback(() => {
    base44.auth.logout();
  }, []);

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

          </div>
        </div>

        {/* User Info */}
        <div className="bg-[#1c3f82] px-4 py-4 border-b border-slate-700/50">
          <div className="bg-slate-800/50 rounded-xl p-3">
            <p className="text-sm font-medium text-white truncate">{user?.full_name || user?.email}</p>
            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              isAdmin ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`
              }>
                {isAdmin ? 'Administrador' : 'Cliente'}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="bg-[#1c3f82] p-4 flex-1 overflow-y-auto space-y-1">
          {isAdmin ? (
            filteredAdminGroups.map((group) => (
              <SidebarNavGroup
                key={group.label}
                label={group.label}
                pages={group.items}
                itemsByPage={adminItemsByPage}
                currentPage={currentPage}
                flags={flags}
                onItemClick={handleMenuClick}
              />
            ))
          ) : (
            clientGroups.map((group) => (
              <SidebarNavGroup
                key={group.label}
                label={group.label}
                pages={group.items}
                itemsByPage={clientItemsByPage}
                currentPage={currentPage}
                flags={flags}
                onItemClick={handleMenuClick}
              />
            ))
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