import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { prefetchPageData } from '@/lib/adminPagePrefetch';

export default function SidebarNavGroup({ label, pages, itemsByPage, currentPage, flags, onItemClick }) {
  return (
    <div className="mt-4 first:mt-0">
      <div className="px-2 pb-2">
        <div className="inline-flex items-center rounded-full bg-slate-100/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500 shadow-sm">
          {label}
        </div>
      </div>
      <div className="space-y-1.5">
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
                'group flex min-h-[54px] items-center gap-3 rounded-2xl border px-4 py-3 transition-all duration-200 touch-manipulation',
                isActive
                  ? 'border-primary/15 bg-gradient-to-r from-primary to-sky-500 text-primary-foreground shadow-card'
                  : 'border-transparent bg-white/70 text-slate-600 shadow-sm hover:-translate-y-0.5 hover:border-border/70 hover:bg-white hover:text-foreground'
              ].join(' ')}
            >
              <div className={[
                'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-colors',
                isActive ? 'bg-white/18 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-accent group-hover:text-foreground'
              ].join(' ')}>
                <Icon className="h-5 w-5" />
              </div>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{item.name}</span>
              {flags?.[item.page] && (
                <span className={['h-2.5 w-2.5 rounded-full shadow-sm', isActive ? 'bg-white' : 'bg-amber-400'].join(' ')} />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}