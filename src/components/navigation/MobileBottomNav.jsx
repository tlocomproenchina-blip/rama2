import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Package, FileText, LifeBuoy, User } from 'lucide-react';

const items = [
  { label: 'Inicio', path: '/Dashboard', icon: Home, match: ['/Dashboard', '/ClientPortal'] },
  { label: 'Paquetes', path: '/MyPackages', icon: Package, match: ['/MyPackages', '/PreAlert', '/RequestConsolidation', '/MyConsolidations'] },
  { label: 'Facturas', path: '/MyInvoices', icon: FileText, match: ['/MyInvoices', '/AssistedPayment'] },
  { label: 'Soporte', path: '/Support', icon: LifeBuoy, match: ['/Support', '/FAQ'] },
  { label: 'Perfil', path: '/Profile', icon: User, match: ['/Profile', '/MyReferrals'] },
];

export default function MobileBottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-white/95 backdrop-blur lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="mx-auto grid max-w-screen-sm grid-cols-5 px-2 py-2 shadow-[0_-10px_30px_-20px_rgba(15,23,42,0.35)]">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.match.includes(location.pathname);

          return (
            <Link
              key={item.path}
              to={item.path}
              className={[
                'flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[11px] font-semibold transition-colors duration-150',
                isActive
                  ? 'bg-accent text-primary shadow-sm'
                  : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
              ].join(' ')}
            >
              <Icon className="h-4 w-4" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}