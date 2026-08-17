import React from 'react';
import { Home, Package, FileText, LifeBuoy, User } from 'lucide-react';
import useTabNavigation from '@/components/navigation/useTabNavigation';

const items = [
  { key: 'inicio', label: 'Inicio', icon: Home },
  { key: 'paquetes', label: 'Paquetes', icon: Package },
  { key: 'facturas', label: 'Facturas', icon: FileText },
  { key: 'soporte', label: 'Soporte', icon: LifeBuoy },
  { key: 'perfil', label: 'Perfil', icon: User },
];

export default function MobileBottomNav() {
  const { activeTab, handleTabClick } = useTabNavigation();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-card/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navegación principal"
    >
      <div className="mx-auto grid max-w-screen-sm grid-cols-5 px-2 py-2 shadow-[0_-10px_30px_-20px_rgba(15,23,42,0.35)]">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleTabClick(item.key)}
              className={[
                'flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[11px] font-semibold touch-manipulation',
                isActive
                  ? 'bg-accent text-primary shadow-sm'
                  : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
              ].join(' ')}
            >
              <Icon className="h-4 w-4" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}