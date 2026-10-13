import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Package, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { base44 } from '@/components/api/ApiQueueManager';
import { cacheManager } from '@/components/CacheManager';
import OptimizedImage from '@/components/OptimizedImage';
import useAttentionFlags from '@/components/notifications/useAttentionFlags';
import useNotificationFlags from '@/components/notifications/useNotificationFlags';
import SidebarNavGroup from '@/components/sidebar/SidebarNavGroup';
import SidebarLogoutButton from '@/components/sidebar/SidebarLogoutButton';
import {
  adminGroups,
  adminMenuItems,
  clientGroups,
  clientMenuItems,
} from '@/components/sidebar/sidebarConfig';
import { getDefaultRoleConfig } from '@/lib/rolePermissions';
import { allowedPagesFor, isAreaEmployee } from '@/lib/areaAccess';
import useAreaAccess from '@/hooks/useAreaAccess';

export default function Sidebar({ user, currentPage, isOpen, onClose, initialConfig }) {
  const [config, setConfig] = useState(initialConfig || null);
  // Módulos del área del empleado (misma fuente que usa el guardia de rutas)
  const { roleConfig } = useAreaAccess(user, currentPage);


  const loadConfig = useCallback(async () => {
    try {
      if (initialConfig) {
        // Si el caché tiene una versión más reciente (ej. tras editar la
        // visibilidad del menú), usarla para reflejar el cambio sin recargar.
        const cachedConfig = cacheManager.get('app_config');
        const cacheNewer = cachedConfig?.updated_date && initialConfig?.updated_date
          && new Date(cachedConfig.updated_date) > new Date(initialConfig.updated_date);
        setConfig(cacheNewer ? cachedConfig : initialConfig);
        if (!cacheNewer) cacheManager.set('app_config', initialConfig, 3600000);
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


  const isAdmin = user?.role === 'admin';
  const [attFlags, attMarkSeen] = useAttentionFlags({ user });
  const { flags: notifFlags, markSeen: notifMarkSeen } = useNotificationFlags({ user });
  const flags = useMemo(() => ({ ...attFlags, ...notifFlags }), [attFlags, notifFlags]);
  // No mostrar el punto rojo en la página en la que el usuario ya se encuentra
  const displayFlags = useMemo(() => {
    if (!currentPage) return flags;
    return { ...flags, [currentPage]: false };
  }, [flags, currentPage]);

  const handleMenuClick = useCallback((page) => {
    if (page) {
      try { attMarkSeen(page); } catch {}
      try { notifMarkSeen(page); } catch {}
    }
    onClose && onClose();
  }, [attMarkSeen, notifMarkSeen, onClose]);
  // Auto-marcar como visto si el usuario llegó a la página por otra vía (no solo desde el sidebar)
  useEffect(() => {
    try {
      if (currentPage && flags[currentPage]) {
        attMarkSeen(currentPage);
        notifMarkSeen(currentPage);
      }
    } catch {}
  }, [currentPage, flags, attMarkSeen, notifMarkSeen]);
  // Notifications UI disabled
  const showWarning = false;
  const badgeCount = 0;


  const visibleAdminPages = useMemo(() => {
    if (user?.role !== 'admin') return [];
    const hidden = new Set(config?.sidebar_hidden_pages || []);
    const available = adminMenuItems.map((item) => item.page).filter((page) => !hidden.has(page));
    // El empleado con área solo ve los módulos de su área; el administrador
    // sin área ve todo el panel.
    if (!isAreaEmployee(user)) return available;
    const allowed = new Set(allowedPagesFor(user, roleConfig) || []);
    return available.filter((page) => allowed.has(page));
  }, [user, config?.sidebar_hidden_pages, roleConfig]);

  const filteredAdminMenuItems = useMemo(() => adminMenuItems.filter((item) => visibleAdminPages.includes(item.page)), [visibleAdminPages]);
  const filteredAdminGroups = useMemo(() => {
    return adminGroups.map((group) => ({
      ...group,
      items: group.items.filter((page) => visibleAdminPages.includes(page))
    })).filter((group) => group.items.length > 0);
  }, [visibleAdminPages]);

  const adminItemsByPage = useMemo(() => Object.fromEntries(filteredAdminMenuItems.map((item) => [item.page, item])), [filteredAdminMenuItems]);
  const clientItemsByPage = useMemo(() => Object.fromEntries(clientMenuItems.map((item) => [item.page, item])), []);

  const filteredClientGroups = useMemo(() => {
    const hidden = new Set(config?.client_hidden_pages || []);
    return clientGroups.map((group) => ({
      ...group,
      items: group.items.filter((page) => !hidden.has(page))
    })).filter((group) => group.items.length > 0);
  }, [config?.client_hidden_pages]);


  const handleLogout = useCallback(() => {
    // Limpiar la suscripción push del usuario antes de cerrar sesión
    // para que el dispositivo no siga recibiendo notificaciones de este usuario
    base44.functions.invoke('removePushSubscription', {}).catch(() => {}).finally(() => {
      base44.auth.logout();
    });
  }, []);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen &&
      <div
        className="fixed inset-0 z-40 bg-slate-950/35 lg:hidden"
        onClick={onClose} />

      }
      
      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 lg:static lg:inset-y-0 lg:left-0 lg:h-full
          w-[min(20rem,calc(100vw-0.75rem))] lg:w-80 rounded-r-[2rem] lg:rounded-none
          border-y-0 border-l-0 border-r border-border/60 bg-sidebar/95
          ${isOpen ? 'translate-x-0' : '-translate-x-[calc(100%+0.5rem)] lg:translate-x-0'}
          flex flex-col overflow-hidden shadow-[0_18px_42px_-24px_rgba(15,23,42,0.24)] lg:backdrop-blur-xl
        `}
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.15rem)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.15rem)' }}
      >
        <div className="pointer-events-none absolute inset-0 hidden overflow-hidden lg:block">
          <div className="absolute inset-x-6 top-0 h-40 rounded-b-[2rem] bg-gradient-to-b from-white/90 to-transparent" />
          <div className="absolute -right-10 top-24 h-36 w-36 rounded-full bg-sky-200/35 blur-3xl" />
          <div className="absolute -left-10 bottom-24 h-36 w-36 rounded-full bg-blue-200/30 blur-3xl" />
        </div>
        {/* Navigation: marca y usuario integrados arriba de la barra lateral,
            dentro del área desplazable, para que no queden fijos al hacer scroll */}
        <nav className="relative flex-1 overflow-y-auto px-4 py-4 lg:py-5 [scrollbar-width:thin] [scrollbar-color:hsl(var(--border))_transparent]">
          <div className="relative mb-3 space-y-3">
            <div className="relative rounded-[1.75rem] border border-border/80 bg-card/85 p-4 shadow-card backdrop-blur transition-all duration-300 hover:shadow-premium">
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-3 top-3 h-8 w-8 rounded-xl border border-border/70 bg-card/80 lg:hidden"
                onClick={onClose}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
              <div className="flex items-center gap-3 min-w-0 pr-10 lg:pr-0">
                {config?.app_logo_url ? (
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-card shadow-card ring-1 ring-border/60">
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
                  <p className="hidden text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/70 lg:block">Panel</p>
                  <h1 className="truncate font-display text-lg font-bold text-foreground">
                    {config?.app_name || 'TLEC CARGO'}
                  </h1>
                  <p className="hidden truncate text-[12px] text-muted-foreground lg:block">
                    {config?.app_tagline || 'Sistema de Envíos'}
                  </p>
                </div>
              </div>
            </div>

            <div className="hidden rounded-[1.5rem] border border-border/80 bg-card/78 p-4 shadow-sm backdrop-blur transition-all duration-300 hover:bg-card/88 lg:block">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold tracking-[-0.01em] text-foreground">{user?.full_name || user?.email}</p>
                  <p className="mt-1 truncate text-[12px] text-muted-foreground">{user?.email}</p>
                </div>
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                isAdmin ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`
                }>
                  {isAdmin ? (roleConfig?.role_name || getDefaultRoleConfig(user?.custom_role)?.role_name || 'Administrador') : 'Cliente'}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-border/75 bg-card/58 p-3 shadow-sm backdrop-blur transition-all duration-300">
          {isAdmin ? (
            filteredAdminGroups.map((group) => (
              <SidebarNavGroup
                key={group.label}
                label={group.label}
                pages={group.items}
                itemsByPage={adminItemsByPage}
                currentPage={currentPage}
                flags={displayFlags}
                onItemClick={handleMenuClick}
              />
            ))
          ) : (
            filteredClientGroups.map((group) => (
              <SidebarNavGroup
                key={group.label}
                label={group.label}
                pages={group.items}
                itemsByPage={clientItemsByPage}
                currentPage={currentPage}
                flags={displayFlags}
                onItemClick={handleMenuClick}
              />
            ))
          )}
          {/* Cerrar Sesión: justo debajo de Configuración, al final del menú */}
          <SidebarLogoutButton onClick={handleLogout} />
          </div>
        </nav>
      </aside>
    </>);

}