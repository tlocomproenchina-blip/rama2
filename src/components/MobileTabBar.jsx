import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Package, Truck, Home, Headphones } from 'lucide-react';

export default function MobileTabBar() {
  const location = useLocation();
  const currentPath = location.pathname;

  const tabs = [
    { name: 'Inicio', page: 'Dashboard', icon: Home },
    { name: 'Paquetes', page: 'MyPackages', icon: Package },
    { name: 'Consolidaciones', page: 'MyConsolidations', icon: Truck },
    { name: 'Soporte', page: 'Support', icon: Headphones }
  ];

  const isActive = (page) => {
    const pageUrl = createPageUrl(page);
    return currentPath === pageUrl;
  };

  return (
    <nav 
      className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 z-40 select-none"
      style={{ 
        paddingBottom: 'env(safe-area-inset-bottom, 0px)'
      }}
    >
      <div className="grid grid-cols-4 h-16">
        {tabs.map((tab) => {
          const active = isActive(tab.page);
          return (
            <Link
              key={tab.page}
              to={createPageUrl(tab.page)}
              className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                active 
                  ? 'text-blue-600 dark:text-blue-400' 
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <tab.icon className={`h-5 w-5 ${active ? 'scale-110' : ''} transition-transform`} />
              <span className="text-xs font-medium">{tab.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}