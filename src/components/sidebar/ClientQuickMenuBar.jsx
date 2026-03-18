import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';

export default function ClientQuickMenuBar({ items = [], currentPage, onItemClick }) {
  return (
    <div className="border-b border-slate-700/50 bg-[#1c3f82] px-4 py-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.page;

          return (
            <Link
              key={item.page}
              to={createPageUrl(item.page)}
              onClick={() => onItemClick(item.page)}
              className={cn(
                'flex min-w-fit items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors',
                isActive
                  ? 'border-blue-400 bg-blue-600 text-white'
                  : 'border-slate-600 bg-slate-800/40 text-slate-200 hover:bg-slate-700/60 hover:text-white'
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}