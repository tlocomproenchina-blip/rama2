import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { prefetchPageData } from '@/lib/adminPagePrefetch';

export default function SidebarNavGroup({ label, pages, itemsByPage, currentPage, flags, onItemClick }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-5 first:mt-0">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center gap-3 px-2 pb-2.5 text-left"
      >
        <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent" />
        <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400">
          {label}
        </div>
        <ChevronDown className={['h-4 w-4 text-slate-300 transition-transform duration-200', isOpen ? 'rotate-180' : 'rotate-0'].join(' ')} />
      </button>
      <div className={['grid transition-all duration-200', isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'].join(' ')}>
        <div className="overflow-hidden">
          <div className="space-y-2 pb-1">
            {pages.map((page) => {
              const item = itemsByPage[page];
              if (!item) return null;

              const Icon = item.icon;
              const isActive = currentPage === item.page;

              return (
                <Link
                  key={item.page}
                  to={createPageUrl(item.page)}
                  onMouseEnter={() => prefetchPageData(item.page)}
                  onFocus={() => prefetchPageData(item.page)}
                  onTouchStart={() => prefetchPageData(item.page)}
                  onClick={() => {
                    prefetchPageData(item.page);
                    onItemClick(item.page);
                  }}
                  className={[
                    'group relative flex min-h-[58px] items-center gap-3 rounded-2xl border px-4 py-3 transition-all duration-200 touch-manipulation will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2',
                    isActive
                      ? 'border-primary/10 bg-gradient-to-r from-primary via-sky-500 to-blue-500 text-primary-foreground shadow-premium'
                      : 'border-transparent bg-white/60 text-slate-600 hover:-translate-y-0.5 hover:border-border/70 hover:bg-white hover:text-foreground hover:shadow-card'
                  ].join(' ')}
                >
                  <div className={[
                    'absolute left-1.5 top-1/2 h-8 w-1 -translate-y-1/2 rounded-full transition-all duration-200',
                    isActive ? 'bg-white/85 opacity-100' : 'bg-primary/20 opacity-0 group-hover:opacity-100'
                  ].join(' ')} />
                  <div className={[
                    'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-all duration-200',
                    isActive ? 'bg-white/18 text-white shadow-sm' : 'bg-slate-100 text-slate-500 group-hover:bg-accent group-hover:text-foreground'
                  ].join(' ')}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold tracking-[-0.01em]">{item.name}</span>
                  </div>
                  {flags?.[item.page] && (
                    <span className={['h-2.5 w-2.5 rounded-full shadow-sm', isActive ? 'bg-white' : 'bg-amber-400'].join(' ')} />
                  )}
                  <ChevronRight className={[
                    'h-4 w-4 flex-shrink-0 transition-all duration-200',
                    isActive ? 'translate-x-0 text-white/90' : 'text-slate-300 group-hover:translate-x-0.5 group-hover:text-slate-500'
                  ].join(' ')} />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}