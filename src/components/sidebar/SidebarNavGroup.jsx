import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { prefetchPageData } from '@/lib/adminPagePrefetch';

export default function SidebarNavGroup({ label, pages, itemsByPage, currentPage, flags, onItemClick }) {
  return (
    <div className="mt-3 first:mt-0">
      <div className="px-3 py-2 text-[10px] font-semibold tracking-wide text-slate-300/70 uppercase">
        {label}
      </div>
      <div className="space-y-1">
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
                'flex min-h-[52px] items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 touch-manipulation',
                isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
              ].join(' ')}
            >
              <div className="flex items-center gap-3">
                <Icon className="h-5 w-5 flex-shrink-0" />
                <span className="font-medium">{item.name}</span>
                {flags?.[item.page] && (
                  <span className="ml-auto h-2.5 w-2.5 rounded-full bg-amber-400 shadow shadow-amber-500/40" />
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}