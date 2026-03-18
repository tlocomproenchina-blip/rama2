import React from 'react';
import { cn } from '@/lib/utils';

export default function MobileBottomTabs({ items = [], activeKey, onChange }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navegación principal"
    >
      <div className="grid grid-cols-4 gap-1 px-2 pt-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeKey === item.key;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              className={cn(
                'flex min-h-[64px] touch-manipulation flex-col items-center justify-center gap-1 rounded-xl px-2 pb-2 pt-1 text-[11px] font-medium transition-colors',
                isActive ? 'text-blue-600' : 'text-slate-500 active:bg-slate-100'
              )}
            >
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full transition-colors',
                  isActive ? 'bg-blue-50 text-blue-600' : 'text-slate-500'
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}