import React from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import NotificationBell from '@/components/NotificationBell';

export default function NativeMobileHeader({ user, config, currentPageName, showMenu, sidebarOpen, onMenuOpen }) {
  return (
    <header
      className="fixed inset-x-0 top-0 z-40 border-b border-border/60 bg-background/92 px-3 pb-2 pt-3 backdrop-blur lg:hidden"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}
    >
      <div className="rounded-[1.15rem] border border-white/80 bg-white/88 px-3 py-2 shadow-card">
        <div className="flex items-center justify-between gap-2">
          {showMenu ? (
            <Button
              variant="ghost"
              size="icon"
              className={`h-10 w-10 rounded-xl border p-0 transition-all duration-200 ${sidebarOpen ? 'border-primary/20 bg-accent text-foreground shadow-sm' : 'border-border/70 bg-white/80'}`}
              onClick={onMenuOpen}
            >
              <Menu className="h-4.5 w-4.5" />
            </Button>
          ) : (
            <div className="h-10 w-10" />
          )}

          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/70">
              {config?.app_name || 'TLEC CARGO'}
            </p>
            <h1 className="truncate text-sm font-semibold text-foreground">
              {currentPageName || 'Panel'}
            </h1>
          </div>

          <div className="flex h-10 min-w-[40px] items-center justify-end">
            <NotificationBell user={user} />
          </div>
        </div>
      </div>
    </header>
  );
}