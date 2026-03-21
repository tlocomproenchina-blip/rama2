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
        className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden"
        onClick={onClose} />

      }
      
      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        relative w-80 border-r border-border/60 bg-sidebar/95
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        flex flex-col overflow-hidden shadow-[0_24px_60px_-24px_rgba(15,23,42,0.28)] backdrop-blur-xl
      `}>
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-x-6 top-0 h-40 rounded-b-[2rem] bg-gradient-to-b from-white/90 to-transparent" />
          <div className="absolute -right-10 top-24 h-36 w-36 rounded-full bg-sky-200/35 blur-3xl" />
          <div className="absolute -left-10 bottom-24 h-36 w-36 rounded-full bg-blue-200/30 blur-3xl" />
        </div>
        {/* Header */}
        <div className="relative border-b border-border/60 px-5 pb-5 pt-6">
          <div className="rounded-[1.75rem] border border-white/80 bg-white/85 p-4 shadow-card backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {config?.app_logo_url ? (
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-border/60">
                    <OptimizedImage
                      src={config.app_logo_url}
                      alt="Logo"
                      width={48}
                      height={48}
                      className="h-full w-full object-cover"
                      priority={false}
                    />
                  </div>
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-500 shadow-card">
                    <Package className="h-5 w-5 text-white" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/70">Panel</p>
                  <h1 className="truncate font-display text-lg font-bold text-foreground">
                    {config?.app_name || 'TLEC CARGO'}
                  </h1>
                  <p className="truncate text-[12px] text-muted-foreground">
                    {config?.app_tagline || 'Sistema de Envíos'}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-2xl border border-border/70 bg-white/80 lg:hidden"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* User Info */}
        <div className="relative border-b border-border/60 px-5 py-4">
          <div className="rounded-[1.5rem] border border-white/80 bg-white/78 p-4 shadow-sm backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tracking-[-0.01em] text-foreground">{user?.full_name || user?.email}</p>
                <p className="mt-1 truncate text-[12px] text-muted-foreground">{user?.email}</p>
              </div>
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              isAdmin ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`
              }>
                {isAdmin ? 'Administrador' : 'Cliente'}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="relative flex-1 overflow-y-auto px-4 py-5">
          <div className="rounded-[1.75rem] border border-white/75 bg-white/58 p-3 shadow-sm backdrop-blur">
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
          </div>
        </nav>

        {/* Logout */}
        <div className="relative border-t border-border/60 px-4 py-4">
          <div className="rounded-[1.5rem] border border-white/80 bg-white/82 p-2 shadow-sm backdrop-blur">
            <Button
              variant="ghost"
              className="w-full justify-start rounded-xl text-muted-foreground hover:bg-accent/80 hover:text-foreground"
              onClick={handleLogout}>
              <LogOut className="mr-3 h-5 w-5" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </aside>
    </>);

}