import React from 'react';
import { cn } from '@/lib/utils';

export default function MobileBottomTabs({ items = [], activeKey, pendingKey, onChange }) {
  return (
    <nav
      className="fixed inset-x-3 bottom-3 z-30 rounded-[28px] border border-slate-200/80 bg-white/90 shadow-[0_12px_40px_rgba(15,23,42,0.14)] backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navegación principal"
    >
      <div className="grid grid-cols-4 gap-1 p-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isPending = pendingKey === item.key;
          const isActive = activeKey === item.key;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              className={cn(
                'flex min-h-[64px] touch-manipulation flex-col items-center justify-center gap-1 rounded-2xl px-2 pb-2 pt-1 text-[11px] font-medium transition-all duration-200',
                isActive ? 'bg-blue-50/90 text-blue-600 shadow-sm' : 'text-slate-500 active:scale-[0.98] active:bg-slate-100'
              )}
            >
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200',
                  isActive ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500',
                  isPending && 'animate-pulse'
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