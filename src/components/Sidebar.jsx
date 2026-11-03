import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Package, X, Search } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { base44 } from '@/components/api/ApiQueueManager';
import { cacheManager } from '@/components/CacheManager';
import OptimizedImage from '@/components/OptimizedImage';
import useAttentionFlags from '@/components/notifications/useAttentionFlags';
import useNotificationFlags from '@/components/notifications/useNotificationFlags';
import SidebarLogoutButton from '@/components/sidebar/SidebarLogoutButton';
import SidebarSections from '@/components/sidebar/SidebarSections';
import CommandSearch from '@/components/sidebar/CommandSearch';
import { setNavState } from '@/components/sidebar/navStore';
import { clientMenuItems } from '@/components/sidebar/sidebarConfig';
import { ADMIN_SECTIONS, CLIENT_SECTIONS, filterSections, findSection, setLastTab } from '@/components/sidebar/sectionsConfig';
import { getAreaPreset, menuPagesFor } from '@/lib/areaAccess';
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


  // Módulos del menú: el empleado de área ve los módulos de su área y el
  // administrador sin área el panel según la lista general (ver areaAccess).
  const visibleAdminPages = useMemo(
    () => (user?.role !== 'admin' ? [] : menuPagesFor(user, config, roleConfig)),
    [user, config, roleConfig]
  );

  const sections = useMemo(() => {
    if (isAdmin) return filterSections(ADMIN_SECTIONS, visibleAdminPages);
    const hidden = new Set(config?.client_hidden_pages || []);
    return filterSections(CLIENT_SECTIONS, clientMenuItems.map((i) => i.page).filter((pg) => !hidden.has(pg)));
  }, [isAdmin, visibleAdminPages, config?.client_hidden_pages]);

  // Comparte secciones y puntos rojos con las pestañas de la página
  useEffect(() => { setNavState({ sections, flags: displayFlags }); }, [sections, displayFlags]);

  // Recordar la última pestaña visitada de cada sección
  useEffect(() => {
    const section = findSection(sections, currentPage);
    if (section && section.pages.some((x) => x.page === currentPage)) setLastTab(section.id, currentPage);
  }, [sections, currentPage]);

  const [searchOpen, setSearchOpen] = useState(false);


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
          fixed inset-y-0 left-0 z-50 lg:static lg:h-full
          w-[min(16rem,calc(100vw-3rem))] lg:w-60
          border-r border-border bg-sidebar
          ${isOpen ? 'translate-x-0' : '-translate-x-[calc(100%+0.5rem)] lg:translate-x-0'}
          flex flex-col overflow-hidden
        `}
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center gap-2.5 border-b border-border px-3 py-3">
          {config?.app_logo_url ? (
            <OptimizedImage src={config.app_logo_url} alt="Logo" width={32} height={32} className="h-8 w-8 shrink-0 rounded-lg object-cover" priority={false} />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
              <Package className="h-4 w-4 text-primary-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-bold text-foreground">{config?.app_name || 'TLEC CARGO'}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {isAdmin ? (roleConfig?.role_name || getAreaPreset(user?.custom_role)?.role_name || 'Administrador') : 'Cliente'}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 lg:hidden" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-2 pt-2">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex h-10 w-full items-center gap-3 rounded-lg border border-border px-3 text-sm text-muted-foreground hover:bg-accent"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">Buscar página</span>
            <kbd className="hidden rounded border border-border px-1.5 text-[10px] lg:inline">Ctrl K</kbd>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-2 [scrollbar-width:thin]">
          <SidebarSections sections={sections} currentPage={currentPage} flags={displayFlags} onNavigate={handleMenuClick} />
        </nav>

        <div className="border-t border-border px-2 py-2">
          <p className="truncate px-3 pb-1 text-[11px] text-muted-foreground">{user?.email}</p>
          <SidebarLogoutButton onClick={handleLogout} />
        </div>
      </aside>

      <CommandSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        sections={sections}
        isAdmin={isAdmin}
        onNavigate={handleMenuClick}
      />
    </>);

}