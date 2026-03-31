import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { adminMenuItems, adminGroups } from '@/components/sidebar/sidebarConfig';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function AdminMobileMoreMenu({ open, onClose }) {
  const location = useLocation();

  if (!open) return null;

  const itemMap = {};
  adminMenuItems.forEach(item => { itemMap[item.page] = item; });

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 max-h-[80vh] rounded-t-3xl border-t border-border/60 bg-white shadow-premium animate-in slide-in-from-bottom duration-300"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}>
        <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
          <h2 className="font-display text-lg font-semibold text-foreground">Menú Administrativo</h2>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="max-h-[calc(80vh-4rem)]">
          <div className="space-y-4 px-4 py-4">
            {adminGroups.map((group) => {
              const groupItems = group.items
                .map(page => itemMap[page])
                .filter(Boolean);
              if (groupItems.length === 0) return null;

              return (
                <div key={group.label}>
                  <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    {group.label}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {groupItems.map((item) => {
                      const Icon = item.icon;
                      const path = `/${item.page}`;
                      const isActive = location.pathname === path;

                      return (
                        <Link
                          key={item.page}
                          to={path}
                          onClick={onClose}
                          className={[
                            'flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 text-center transition-all duration-200',
                            isActive
                              ? 'bg-primary/10 text-primary shadow-sm'
                              : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground active:scale-95'
                          ].join(' ')}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="line-clamp-2 text-[10px] font-medium leading-tight">{item.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}