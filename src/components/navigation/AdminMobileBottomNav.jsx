import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, FileText, CreditCard, MoreHorizontal } from 'lucide-react';
import AdminMobileMoreMenu from './AdminMobileMoreMenu';

const items = [
  { label: 'Panel', path: '/AccountingDashboard', icon: LayoutDashboard, match: ['/AccountingDashboard', '/AdminDashboard', '/AdminOperaciones'] },
  { label: 'Paquetes', path: '/AdminPackages', icon: Package, match: ['/AdminPackages', '/WarehouseReceive', '/WarehouseDashboard'] },
  { label: 'Facturas', path: '/AdminInvoices', icon: FileText, match: ['/AdminInvoices', '/AdminPayments'] },
  { label: 'Pagos', path: '/AdminPayments', icon: CreditCard, match: ['/AdminPayments', '/AdminAssistedPayments', '/AdminProviderPayments'] },
];

export default function AdminMobileBottomNav() {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const isMoreActive = !items.some(item => item.match.includes(location.pathname));

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-white/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto grid max-w-screen-sm grid-cols-5 px-2 py-2">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = item.match.includes(location.pathname);

            return (
              <Link
                key={item.path}
                to={item.path}
                className={[
                  'flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[11px] font-semibold transition-all duration-200',
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

          <button
            onClick={() => setMoreOpen(true)}
            className={[
              'flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[11px] font-semibold transition-all duration-200',
              isMoreActive || moreOpen
                ? 'bg-accent text-primary shadow-sm'
                : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
            ].join(' ')}
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="truncate">Más</span>
          </button>
        </div>
      </nav>

      <AdminMobileMoreMenu open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}