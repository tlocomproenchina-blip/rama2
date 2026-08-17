import { useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// Definición de tabs (coincide con MobileBottomNav)
const TABS = [
  { key: 'inicio', home: '/Dashboard', match: ['/Dashboard', '/ClientPortal'] },
  { key: 'paquetes', home: '/MyPackages', match: ['/MyPackages', '/PreAlert', '/RequestConsolidation', '/MyConsolidations'] },
  { key: 'facturas', home: '/MyInvoices', match: ['/MyInvoices', '/AssistedPayment'] },
  { key: 'soporte', home: '/Support', match: ['/Support', '/FAQ'] },
  { key: 'perfil', home: '/Profile', match: ['/Profile', '/MyReferrals'] },
];

function tabForPath(path) {
  return TABS.find((t) => t.match.includes(path)) || null;
}

/**
 * Hook de navegación por tabs con stacks paralelos en memoria + caché de scroll.
 * - Cada tab mantiene su propio stack de rutas visitadas.
 * - Al volver a un tab, restaura la última ruta y posición de scroll.
 * - Tocar el tab activo reinicia su stack al home.
 */
export default function useTabNavigation() {
  const location = useLocation();
  const navigate = useNavigate();

  const stacksRef = useRef({});
  const scrollCacheRef = useRef({});
  const activeTabRef = useRef(null);
  const prevPathRef = useRef(location.pathname);

  // Inicializar stacks una sola vez
  if (Object.keys(stacksRef.current).length === 0) {
    TABS.forEach((t) => { stacksRef.current[t.key] = [t.home]; });
  }

  const currentTab = tabForPath(location.pathname);
  const currentTabKey = currentTab?.key || activeTabRef.current;

  // Sincronizar stacks + caché de scroll al cambiar de ruta
  useEffect(() => {
    const prevPath = prevPathRef.current;
    const path = location.pathname;

    // Guardar scroll de la ruta anterior
    if (prevPath && prevPath !== path) {
      try {
        scrollCacheRef.current[prevPath] = window.scrollY;
      } catch (_) {}
    }

    const prevTab = tabForPath(prevPath);
    const newTab = tabForPath(path);

    if (newTab) {
      const stack = stacksRef.current[newTab.key] || [newTab.home];
      if (prevTab?.key === newTab.key) {
        // Misma tab, nueva ruta anidada: apilar
        if (path !== stack[stack.length - 1] && !stack.includes(path)) {
          stack.push(path);
          stacksRef.current[newTab.key] = stack;
        }
      } else {
        // Cambio de tab: asegurar que la ruta actual está en el stack del nuevo tab
        if (!stack.includes(path)) {
          stack.push(path);
          stacksRef.current[newTab.key] = stack;
        }
      }
      activeTabRef.current = newTab.key;
    }

    // Restaurar scroll de la nueva ruta
    const cached = scrollCacheRef.current[path];
    try {
      requestAnimationFrame(() => {
        window.scrollTo(0, cached != null ? cached : 0);
      });
    } catch (_) {}

    prevPathRef.current = path;
  }, [location.pathname]);

  const handleTabClick = useCallback((tabKey) => {
    const tab = TABS.find((t) => t.key === tabKey);
    if (!tab) return;
    const stack = stacksRef.current[tabKey] || [tab.home];
    const target = stack[stack.length - 1] || tab.home;

    // Tocar el tab activo reinicia al home de ese tab
    if (activeTabRef.current === tabKey && target === location.pathname) {
      stacksRef.current[tabKey] = [tab.home];
      navigate(tab.home);
      return;
    }
    navigate(target);
  }, [location.pathname, navigate]);

  return {
    activeTab: currentTabKey,
    handleTabClick,
    tabs: TABS,
  };
}